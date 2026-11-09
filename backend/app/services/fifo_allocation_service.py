
"""Admin-restricted FIFO allocation for newly confirmed payments.

The caller owns the transaction and must commit or roll back.
Historical payments must continue through manual reconciliation.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.drink_session import DrinkSession
from app.models.enums import PaymentStatus, UserRole
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.session_participant import SessionParticipant
from app.models.user import User


ZERO = Decimal("0.00")


@dataclass(frozen=True)
class FIFOAllocationResult:
    """Summary of a FIFO allocation operation."""

    payment_id: int
    handler_id: int
    total_allocated: Decimal
    remaining_payment: Decimal
    allocations_created: int


def _require_active_handler(db: Session, handler_id: int) -> User:
    """Return the active Admin/Super Admin assigned to the payment."""
    handler = db.scalar(
        select(User).where(User.id == handler_id)
    )

    if handler is None or not handler.is_active:
        raise ValueError("The payment's assigned handler is unavailable")

    if handler.role not in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise ValueError("The payment's assigned handler is not an Admin")

    return handler


def _authorize_actor(actor: User, handler_id: int) -> None:
    """Ensure the actor is allowed to allocate for this handler."""
    if not actor.is_active:
        raise PermissionError("Inactive users cannot allocate payments")

    if actor.role == UserRole.SUPER_ADMIN:
        return

    if actor.role != UserRole.ADMIN:
        raise PermissionError("Only Admins and Super Admins can allocate payments")

    if actor.id != handler_id:
        raise PermissionError("An Admin can only allocate payments assigned to themselves")


def _sum_payment_allocations(db: Session, payment_id: int) -> Decimal:
    """Return all amounts already allocated from this payment."""
    total = db.scalar(
        select(func.coalesce(func.sum(PaymentAllocation.amount), ZERO)).where(
            PaymentAllocation.payment_id == payment_id
        )
    )
    return Decimal(str(total or ZERO))


def _sum_participant_allocations(
    db: Session,
    participant_id: int,
) -> Decimal:
    """Return all amounts already allocated against this participant's debt."""
    total = db.scalar(
        select(func.coalesce(func.sum(PaymentAllocation.amount), ZERO)).where(
            PaymentAllocation.session_participant_id == participant_id
        )
    )
    return Decimal(str(total or ZERO))


def allocate_payment_fifo(
    db: Session,
    *,
    payment_id: int,
    actor: User,
) -> FIFOAllocationResult:
    """Allocate a confirmed payment to the payer's oldest eligible debts.

    Eligibility:
      - Payment must be CONFIRMED.
      - Payment must have an assigned handler.
      - Handler must be an active Admin or Super Admin.
      - Actor must be an active Admin assigned to the payment,
        or a Super Admin.
      - Participant must belong to the payment owner.
      - Session must be assigned to the payment's handler.

    Existing MANUAL and FIFO allocations both reduce outstanding debt.
    Any excess payment remains unallocated.

    This function flushes new allocation rows but never commits.
    PostgreSQL row locks protect the payment and eligible participant rows.
    """

    # Lock the payment first. Concurrent attempts to allocate the same
    # payment will serialize on this row in PostgreSQL.
    payment = db.scalar(
        select(Payment)
        .where(Payment.id == payment_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    if payment is None:
        raise ValueError("Payment not found")

    if payment.status != PaymentStatus.CONFIRMED:
        raise ValueError("Only CONFIRMED payments can be allocated")

    if payment.handler_id is None:
        raise ValueError("Payment must be assigned to an Admin before FIFO allocation")

    handler_id = payment.handler_id

    _require_active_handler(db, handler_id)
    _authorize_actor(actor, handler_id)

    payment_remaining = Decimal(str(payment.amount)) - _sum_payment_allocations(
        db,
        payment.id,
    )

    if payment_remaining < ZERO:
        raise ValueError("Existing allocations exceed the payment amount")

    if payment_remaining == ZERO:
        return FIFOAllocationResult(
            payment_id=payment.id,
            handler_id=handler_id,
            total_allocated=ZERO,
            remaining_payment=ZERO,
            allocations_created=0,
        )

    # Lock eligible participant rows in deterministic FIFO order.
    # Ordering by session date and session ID makes same-day ordering stable.
    participants = db.scalars(
        select(SessionParticipant)
        .join(
            DrinkSession,
            DrinkSession.id == SessionParticipant.session_id,
        )
        .where(
            SessionParticipant.user_id == payment.user_id,
            DrinkSession.handler_id == handler_id,
        )
        .order_by(
            DrinkSession.session_date.asc(),
            DrinkSession.id.asc(),
            SessionParticipant.id.asc(),
        )
        .with_for_update(of=SessionParticipant)
        .execution_options(populate_existing=True)
    ).all()

    total_allocated = ZERO
    allocations_created = 0

    for participant in participants:
        if payment_remaining <= ZERO:
            break

        amount_owed = Decimal(str(participant.amount_owed))
        already_allocated = _sum_participant_allocations(
            db,
            participant.id,
        )

        participant_remaining = amount_owed - already_allocated

        if participant_remaining < ZERO:
            raise ValueError(
                f"Existing allocations exceed debt for participant {participant.id}"
            )

        if participant_remaining == ZERO:
            continue

        allocation_amount = min(
            participant_remaining,
            payment_remaining,
        )

        if allocation_amount <= ZERO:
            continue

        allocation = PaymentAllocation(
            payment_id=payment.id,
            session_participant_id=participant.id,
            amount=allocation_amount,
            allocation_type="FIFO",
            allocated_by=actor.id,
            reconciliation_id=None,
        )

        db.add(allocation)
        db.flush()

        total_allocated += allocation_amount
        payment_remaining -= allocation_amount
        allocations_created += 1

    return FIFOAllocationResult(
        payment_id=payment.id,
        handler_id=handler_id,
        total_allocated=total_allocated,
        remaining_payment=payment_remaining,
        allocations_created=allocations_created,
    )
