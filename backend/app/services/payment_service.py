"""
Payment business logic.

Users may submit payments only for themselves.
Only admins may confirm or reject pending payments.

Payment status transitions are controlled here rather than directly by
the API layer.
"""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import PaymentStatus, UserRole
from app.models.payment import Payment
from app.models.user import User
from app.services.balance import calculate_user_balance


def create_payment(
    db: Session,
    *,
    user_id: int,
    amount: Decimal,
) -> Payment:
    """
    Create a new PENDING payment for the specified user.

    The caller is responsible for ensuring that `user_id` represents the
    authenticated user. This service does not allow paying on behalf of
    another user.
    """

    amount = Decimal(amount)

    if amount <= 0:
        raise ValueError("Payment amount must be greater than zero")

    user = db.get(User, user_id)

    if user is None:
        raise ValueError("User does not exist")

    if not user.is_active:
        raise ValueError("User is inactive")

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
        amount=amount,
        status=PaymentStatus.PENDING,
    )

    db.add(payment)
    db.flush()

    return payment


def confirm_payment(
    db: Session,
    *,
    payment_id: int,
    admin_user_id: int,
    commit: bool = True,
) -> Payment:
    """
    Confirm a pending payment.

    The caller must already have verified that the authenticated user
    is an admin.
    """

    admin = db.get(User, admin_user_id)

    if admin is None:
        raise ValueError("Admin user does not exist")

    if not admin.is_active:
        raise ValueError("Admin user is inactive")

    if admin.role != UserRole.ADMIN:
        raise PermissionError("Only admins can confirm payments")

    payment = db.get(Payment, payment_id)

    if payment is None:
        raise ValueError("Payment does not exist")

    if payment.status != PaymentStatus.PENDING:
        raise ValueError(
            f"Only PENDING payments can be confirmed; "
            f"current status is {payment.status.value}"
        )

    payment.status = PaymentStatus.CONFIRMED
    payment.confirmed_at = datetime.now(timezone.utc)
    payment.confirmed_by = admin_user_id

    if commit:
        db.commit()
        db.refresh(payment)
    else:
        db.flush()

    return payment


def reject_payment(
    db: Session,
    *,
    payment_id: int,
    admin_user_id: int,
    commit: bool = True,
) -> Payment:
    """
    Reject a pending payment.

    The caller must already have verified that the authenticated user
    is an admin.
    """

    admin = db.get(User, admin_user_id)

    if admin is None:
        raise ValueError("Admin user does not exist")

    if not admin.is_active:
        raise ValueError("Admin user is inactive")

    if admin.role != UserRole.ADMIN:
        raise PermissionError("Only admins can reject payments")

    payment = db.get(Payment, payment_id)

    if payment is None:
        raise ValueError("Payment does not exist")

    if payment.status != PaymentStatus.PENDING:
        raise ValueError(
            f"Only PENDING payments can be rejected; "
            f"current status is {payment.status.value}"
        )

    payment.status = PaymentStatus.REJECTED
    payment.confirmed_at = None
    payment.confirmed_by = None

    if commit:
        db.commit()
        db.refresh(payment)
    else:
        db.flush()

    return payment