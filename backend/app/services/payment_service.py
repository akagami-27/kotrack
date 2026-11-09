
"""
Payment business logic.

Users may submit payments only for themselves.
Only admins may confirm or reject pending payments.

Payment status transitions are controlled here rather than directly by
the API layer.

The service flushes changes but does not commit. The API endpoint owns
the transaction and is responsible for committing or rolling back.
"""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import PaymentStatus, UserRole, is_admin_role
from app.models.payment import Payment
from app.models.user import User
from app.services.balance import calculate_user_balance
from app.services.fifo_allocation_service import allocate_payment_fifo


def create_payment(
    db: Session,
    *,
    user_id: int,
    amount: Decimal,
    handler_id: int,
) -> Payment:
    """
    Create a new PENDING payment assigned to an active Admin.
    """

    amount = Decimal(amount)

    if not amount.is_finite() or amount <= 0:
        raise ValueError("Payment amount must be greater than zero")

    user = db.get(User, user_id)

    if user is None:
        raise ValueError("User does not exist")

    if not user.is_active:
        raise ValueError("User is inactive")

    handler = _get_active_admin(db, handler_id)

    current_balance = calculate_user_balance(db, user_id)

    if current_balance <= 0:
        raise ValueError("User has no outstanding balance")

    if amount > current_balance:
        raise ValueError(
            f"Payment amount cannot exceed outstanding balance "
            f"of RM{current_balance:.2f}"
        )

    payment = Payment(
        user_id=user_id,
        handler_id=handler.id,
        amount=amount,
        status=PaymentStatus.PENDING,
    )

    db.add(payment)
    db.flush()

    return payment


def _get_active_admin(db: Session, admin_user_id: int) -> User:
    """Validate and return an active Admin or Super Admin."""

    admin = db.get(User, admin_user_id)

    if admin is None:
        raise ValueError("Admin user does not exist")

    if not admin.is_active:
        raise ValueError("Admin user is inactive")

    if not is_admin_role(admin.role):
        raise PermissionError("Only admins can process payments")

    return admin


def _get_pending_payment_for_update(
    db: Session,
    payment_id: int,
) -> Payment:
    """
    Retrieve and lock a payment row before changing its status.

    populate_existing ensures SQLAlchemy refreshes the object from the
    database rather than relying on potentially stale identity-map data.
    """

    statement = (
        select(Payment)
        .where(Payment.id == payment_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    payment = db.scalar(statement)

    if payment is None:
        raise ValueError("Payment does not exist")

    if payment.status != PaymentStatus.PENDING:
        status_value = getattr(payment.status, "value", str(payment.status))

        raise ValueError(
            f"Only PENDING payments can be processed; "
            f"current status is {status_value}"
        )

    return payment


def confirm_payment(
    db: Session,
    *,
    payment_id: int,
    admin_user_id: int,
) -> Payment:
    """
    Confirm a pending payment and allocate it using Admin-restricted FIFO.

    Confirmation and allocation remain in the same transaction.
    The caller must commit or roll back.
    """

    admin = _get_active_admin(db, admin_user_id)

    payment = _get_pending_payment_for_update(db, payment_id)

    if payment.handler_id is None:
        raise ValueError(
            "Payment has no assigned Admin. "
            "Assign an Admin before confirming this payment."
        )

    if (
        admin.role != UserRole.SUPER_ADMIN
        and payment.handler_id != admin.id
    ):
        raise PermissionError(
            "You can only confirm payments assigned to yourself"
        )

    payment.status = PaymentStatus.CONFIRMED
    payment.confirmed_at = datetime.now(timezone.utc)
    payment.confirmed_by = admin_user_id

    # Flush confirmation first because FIFO accepts CONFIRMED payments only.
    db.flush()

    # Create FIFO allocations inside this same transaction.
    allocate_payment_fifo(
        db,
        payment_id=payment.id,
        actor=admin,
    )

    db.flush()

    return payment

def reject_payment(
    db: Session,
    *,
    payment_id: int,
    admin_user_id: int,
) -> Payment:
    """
    Reject a pending payment.

    Only the assigned Admin or a Super Admin can reject it.
    The caller must commit or roll back the transaction.
    """

    admin = _get_active_admin(db, admin_user_id)

    payment = _get_pending_payment_for_update(db, payment_id)

    if payment.handler_id is None:
        raise ValueError(
            "Payment has no assigned Admin. "
            "Assign an Admin before rejecting this payment."
        )

    if (
        admin.role != UserRole.SUPER_ADMIN
        and payment.handler_id != admin.id
    ):
        raise PermissionError(
            "You can only reject payments assigned to yourself"
        )

    payment.status = PaymentStatus.REJECTED

    db.flush()

    return payment
