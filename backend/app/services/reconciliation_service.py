"""
Historical Payment Reconciliation Service — Step 5.

Business rules enforced here:
- Only CONFIRMED payments are eligible for reconciliation.
- A payment must be assigned to exactly one Admin (handler_id on Payment).
  On first reconciliation the handler is set; subsequent reconciliations on
  the same payment must use the same handler.
- Each allocation participant must belong to the same user as the payment.
- Each allocation participant's session must be assigned to the specified handler.
- Allocation amount must be > 0 and must not exceed the participant's remaining
  debt for that handler.
- The cumulative total of all allocations in one request must not exceed the
  payment's remaining unallocated amount.
- Calculations use Decimal exclusively.
- Row-level locking (SELECT … FOR UPDATE) is used for the payment and each
  session participant to prevent concurrency races.
  NOTE: FOR UPDATE is a PostgreSQL/real-DB feature; it degrades gracefully to
  a no-op in SQLite (used for unit tests) so concurrency tests require a real DB.
- The overall user balance (balance.py) is not modified here — existing
  confirmed payments already reduce the overall balance. Allocations only
  affect the Admin-scoped accounting.

Do NOT implement FIFO allocation (Step 6) or payment confirmation integration
(Step 7) here.
"""

from decimal import Decimal, InvalidOperation

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.drink_session import DrinkSession
from app.models.enums import PaymentStatus, UserRole, is_admin_role
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.payment_reconciliation import PaymentReconciliation
from app.models.session_participant import SessionParticipant
from app.models.user import User


ZERO = Decimal("0.00")
TWO_PLACES = Decimal("0.01")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_payment_total_allocated(db: Session, payment_id: int) -> Decimal:
    """Return the sum of all existing allocations for a payment."""
    stmt = select(
        func.coalesce(func.sum(PaymentAllocation.amount), ZERO)
    ).where(PaymentAllocation.payment_id == payment_id)
    result = db.execute(stmt).scalar_one()
    return Decimal(str(result))


def _get_participant_total_allocated(
    db: Session,
    session_participant_id: int,
) -> Decimal:
    """
    Return the sum of all existing allocations for a session participant.
    All allocations count regardless of payment status.
    """
    stmt = select(
        func.coalesce(func.sum(PaymentAllocation.amount), ZERO)
    ).where(
        PaymentAllocation.session_participant_id == session_participant_id
    )
    result = db.execute(stmt).scalar_one()
    return Decimal(str(result))


# ---------------------------------------------------------------------------
# Public query helpers
# ---------------------------------------------------------------------------


def get_payment_remaining_amount(db: Session, payment_id: int) -> Decimal:
    """
    Return how much of the payment has not yet been allocated.

    remaining = payment.amount - SUM(all allocations for this payment)
    """
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise ValueError(f"Payment {payment_id} not found.")

    allocated = _get_payment_total_allocated(db, payment_id)
    remaining = Decimal(str(payment.amount)) - allocated
    return max(remaining, ZERO)


def get_participant_remaining_debt(
    db: Session,
    session_participant_id: int,
) -> Decimal:
    """
    Return the participant's remaining debt after existing allocations.

    remaining = sp.amount_owed - SUM(allocations for this sp)
    """
    sp = db.get(SessionParticipant, session_participant_id)
    if sp is None:
        raise ValueError(
            f"SessionParticipant {session_participant_id} not found."
        )

    allocated = _get_participant_total_allocated(db, session_participant_id)
    remaining = Decimal(str(sp.amount_owed)) - allocated
    return max(remaining, ZERO)


def get_eligible_historical_payments(
    db: Session,
    actor: User,
) -> list[dict]:
    """
    Return CONFIRMED payments eligible for reconciliation by this actor,
    enriched with remaining_amount and reconciliation_status.

    SUPER_ADMIN: all confirmed payments.
    ADMIN: confirmed payments whose user has session_participants
           in sessions assigned to this Admin.
    """
    stmt = select(Payment).where(
        Payment.status == PaymentStatus.CONFIRMED
    )

    if actor.role == UserRole.ADMIN:
        eligible_user_ids_stmt = (
            select(SessionParticipant.user_id)
            .join(
                DrinkSession,
                DrinkSession.id == SessionParticipant.session_id,
            )
            .where(DrinkSession.handler_id == actor.id)
            .distinct()
        )

        stmt = stmt.where(
            or_(
                Payment.handler_id == actor.id,
                and_(
                    Payment.handler_id.is_(None),
                    Payment.user_id.in_(eligible_user_ids_stmt),
                ),
            )
        )

    payments = db.execute(stmt).scalars().all()

    result = []
    for p in payments:
        total_allocated = _get_payment_total_allocated(db, p.id)
        payment_amount = Decimal(str(p.amount))
        remaining = max(payment_amount - total_allocated, ZERO)

        if total_allocated == ZERO:
            status = "UNRECONCILED"
        elif remaining == ZERO:
            status = "FULLY_RECONCILED"
        else:
            status = "PARTIAL"

        result.append(
            {
                "id": p.id,
                "user_id": p.user_id,
                "handler_id": p.handler_id,
                "amount": payment_amount,
                "status": p.status,
                "created_at": p.created_at,
                "confirmed_at": p.confirmed_at,
                "confirmed_by": p.confirmed_by,
                "total_allocated": total_allocated,
                "remaining_amount": remaining,
                "reconciliation_status": status,
            }
        )

    return result


def get_payment_with_remaining(db: Session, payment_id: int, actor: User) -> dict:
    """
    Return a single payment enriched with reconciliation accounting.
    Raises PermissionError if actor is not authorised to view this payment.
    """
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise ValueError(f"Payment {payment_id} not found.")

    _assert_payment_visible(db, actor, payment)

    total_allocated = _get_payment_total_allocated(db, payment_id)
    payment_amount = Decimal(str(payment.amount))
    remaining = max(payment_amount - total_allocated, ZERO)

    if total_allocated == ZERO:
        recon_status = "UNRECONCILED"
    elif remaining == ZERO:
        recon_status = "FULLY_RECONCILED"
    else:
        recon_status = "PARTIAL"

    return {
        "id": payment.id,
        "user_id": payment.user_id,
        "handler_id": payment.handler_id,
        "amount": payment_amount,
        "status": payment.status,
        "created_at": payment.created_at,
        "confirmed_at": payment.confirmed_at,
        "confirmed_by": payment.confirmed_by,
        "total_allocated": total_allocated,
        "remaining_amount": remaining,
        "reconciliation_status": recon_status,
    }


def get_reconciliation_history(
    db: Session,
    payment_id: int,
    actor: User,
) -> list[PaymentReconciliation]:
    """
    Return all PaymentReconciliation records for a payment.
    Actor must be SUPER_ADMIN or the assigned handler of the payment.
    """
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise ValueError(f"Payment {payment_id} not found.")

    _assert_payment_visible(db, actor, payment)

    stmt = (
        select(PaymentReconciliation)
        .where(PaymentReconciliation.payment_id == payment_id)
        .options(selectinload(PaymentReconciliation.allocations))
        .order_by(PaymentReconciliation.created_at)
    )
    return list(db.execute(stmt).scalars().all())


def get_reconciliation_detail(
    db: Session,
    reconciliation_id: int,
    actor: User,
) -> PaymentReconciliation:
    """
    Return a single PaymentReconciliation with its allocations.
    Actor must be SUPER_ADMIN or the handler on the reconciliation.
    """
    stmt = (
        select(PaymentReconciliation)
        .where(PaymentReconciliation.id == reconciliation_id)
        .options(selectinload(PaymentReconciliation.allocations))
    )
    recon = db.execute(stmt).scalar_one_or_none()

    if recon is None:
        raise ValueError(f"Reconciliation {reconciliation_id} not found.")

    if actor.role != UserRole.SUPER_ADMIN and recon.handler_id != actor.id:
        raise PermissionError(
            "You are not authorised to view this reconciliation."
        )

    return recon


# ---------------------------------------------------------------------------
# Core create_reconciliation
# ---------------------------------------------------------------------------


def create_reconciliation(
    db: Session,
    *,
    payment_id: int,
    handler_id: int,
    actor: User,
    allocations: list[dict],
    notes: str | None = None,
) -> PaymentReconciliation:
    """
    Atomically create a PaymentReconciliation and its PaymentAllocation rows.

    Parameters
    ----------
    payment_id:  Confirmed payment to reconcile.
    handler_id:  Admin whose sessions the allocations target.
    actor:       Authenticated ADMIN or SUPER_ADMIN performing this action.
    allocations: List of dicts with keys:
                   session_participant_id (int)
                   amount (Decimal)
    notes:       Optional free-text note.

    Raises
    ------
    ValueError       for business-rule violations (400).
    PermissionError  for authorisation failures (403).
    """

    # --- 1. Actor authorisation -------------------------------------------
    if not is_admin_role(actor.role):
        raise PermissionError("Administrator access required.")

    # --- 2. Load and lock the payment row (FOR UPDATE) --------------------
    payment = db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .with_for_update()
    ).scalar_one_or_none()

    if payment is None:
        raise ValueError(f"Payment {payment_id} not found.")

    if payment.status != PaymentStatus.CONFIRMED:
        raise ValueError(
            f"Payment {payment_id} is {payment.status.value}. "
            "Only CONFIRMED payments can be reconciled."
        )

    # --- 3. Validate handler ---------------------------------------------
    handler = db.get(User, handler_id)
    if handler is None or not handler.is_active:
        raise ValueError(f"Handler user {handler_id} not found or inactive.")

    if not is_admin_role(handler.role):
        raise ValueError(
            f"User {handler_id} is not an Admin or Super Admin."
        )

    # --- 4. Handler assignment enforcement --------------------------------
    # Once a payment is assigned to a handler, it stays with that handler.
    if payment.handler_id is not None and payment.handler_id != handler_id:
        raise ValueError(
            f"Payment {payment_id} is already assigned to handler "
            f"{payment.handler_id}. Cannot reassign to handler {handler_id}."
        )

    # Normal Admin can only reconcile as themselves.
    if actor.role == UserRole.ADMIN and handler_id != actor.id:
        raise PermissionError(
            "An Admin can only reconcile payments under their own handler ID."
        )

    # --- 5. Validate allocations list -------------------------------------
    if not allocations:
        raise ValueError("At least one allocation is required.")

    # Detect duplicate participant IDs in this request.
    participant_ids = [a["session_participant_id"] for a in allocations]
    if len(participant_ids) != len(set(participant_ids)):
        raise ValueError(
            "Duplicate session_participant_id values in the same request "
            "are not allowed. Submit one allocation entry per participant."
        )

    # --- 6. Compute payment remaining (under lock) -----------------------
    allocated_so_far = _get_payment_total_allocated(db, payment_id)
    payment_amount = Decimal(str(payment.amount))
    payment_remaining = payment_amount - allocated_so_far

    if payment_remaining <= ZERO:
        raise ValueError(
            f"Payment {payment_id} is fully reconciled. "
            "No remaining amount to allocate."
        )

    # --- 7. Validate each allocation, lock participants ------------------
    validated = []
    cumulative = ZERO

    for alloc in allocations:
        try:
            sp_id = int(alloc["session_participant_id"])
        except (KeyError, TypeError, ValueError):
            raise ValueError(
                "Each allocation must contain a valid session_participant_id."
            )

        try:
            raw_amount = Decimal(str(alloc["amount"]))
        except (KeyError, InvalidOperation, ValueError, TypeError):
            raise ValueError(
                f"Invalid allocation amount for participant {sp_id}."
            )

        if not raw_amount.is_finite() or raw_amount <= ZERO:
            raise ValueError(
                f"Allocation amount for participant {sp_id} "
                "must be a finite value greater than zero."
            )

        try:
            amount = raw_amount.quantize(TWO_PLACES)
        except InvalidOperation:
            raise ValueError(
                f"Invalid allocation precision for participant {sp_id}."
            )

        if amount != raw_amount:
            raise ValueError(
                f"Allocation amount for participant {sp_id} "
                "cannot have more than 2 decimal places."
            )

        # Lock the session_participant row.
        sp = db.execute(
            select(SessionParticipant)
            .where(SessionParticipant.id == sp_id)
            .with_for_update()
        ).scalar_one_or_none()

        if sp is None:
            raise ValueError(f"SessionParticipant {sp_id} not found.")

        # Participant must belong to the same user as the payment.
        if sp.user_id != payment.user_id:
            raise ValueError(
                f"SessionParticipant {sp_id} belongs to user {sp.user_id}, "
                f"not to payment owner {payment.user_id}."
            )

        # The participant's session must be assigned to the handler.
        session = db.get(DrinkSession, sp.session_id)
        if session is None:
            raise ValueError(
                f"Session {sp.session_id} for participant {sp_id} not found."
            )

        if session.handler_id != handler_id:
            raise ValueError(
                f"Session {sp.session_id} is assigned to handler "
                f"{session.handler_id}, not handler {handler_id}."
            )

        # Remaining debt for this participant.
        already_allocated = _get_participant_total_allocated(db, sp_id)
        participant_remaining = (
            Decimal(str(sp.amount_owed)) - already_allocated
        )

        if amount > participant_remaining:
            raise ValueError(
                f"Allocation amount {amount} for participant {sp_id} exceeds "
                f"remaining debt {participant_remaining}."
            )

        cumulative += amount
        validated.append({"sp": sp, "amount": amount})

    # Cumulative must not exceed payment remaining.
    if cumulative > payment_remaining:
        raise ValueError(
            f"Total allocation {cumulative} exceeds payment remaining "
            f"{payment_remaining}."
        )

    # --- 8. Persist all changes atomically --------------------------------

    # Assign handler to payment on first reconciliation.
    if payment.handler_id is None:
        payment.handler_id = handler_id

    # Create the audit record.
    reconciliation = PaymentReconciliation(
        payment_id=payment_id,
        handler_id=handler_id,
        reconciled_by=actor.id,
        notes=notes,
    )
    db.add(reconciliation)
    db.flush()  # Obtain reconciliation.id before creating allocations.

    # Create individual PaymentAllocation rows.
    for item in validated:
        db.add(
            PaymentAllocation(
                payment_id=payment_id,
                session_participant_id=item["sp"].id,
                reconciliation_id=reconciliation.id,
                amount=item["amount"],
                allocation_type="MANUAL",
                allocated_by=actor.id,
            )
        )

    db.flush()

    # Eagerly load allocations for the return value.
    db.refresh(reconciliation)
    _ = reconciliation.allocations

    return reconciliation


# ---------------------------------------------------------------------------
# Internal authorisation helper
# ---------------------------------------------------------------------------


def _assert_payment_visible(
    db: Session,
    actor: User,
    payment: Payment,
) -> None:
    """
    SUPER_ADMIN: may access any payment.

    ADMIN:
    - May access payments assigned to themselves.
    - May access unassigned payments only if the payment owner participates
      in a session assigned to them.
    - May not access payments assigned to another handler.
    """
    if actor.role == UserRole.SUPER_ADMIN:
        return

    if actor.role != UserRole.ADMIN:
        raise PermissionError("Administrator access required.")

    if payment.handler_id is not None:
        if payment.handler_id != actor.id:
            raise PermissionError(
                "You are not authorised to access this payment."
            )
        return

    eligible_participant = db.execute(
        select(SessionParticipant.id)
        .join(
            DrinkSession,
            DrinkSession.id == SessionParticipant.session_id,
        )
        .where(
            SessionParticipant.user_id == payment.user_id,
            DrinkSession.handler_id == actor.id,
        )
        .limit(1)
    ).scalar_one_or_none()

    if eligible_participant is None:
        raise PermissionError(
            "You are not authorised to access this payment."
        )
