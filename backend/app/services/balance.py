"""
User balance calculation.

A user's outstanding balance is derived, never stored directly:

    balance = (total amount owed across all sessions they participated in)
            - (total of their CONFIRMED payments)

PENDING and REJECTED payments never affect the balance. A positive balance
means the user still owes money; zero or negative means they are settled
or in credit.
"""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.enums import PaymentStatus
from app.models.payment import Payment
from app.models.session_participant import SessionParticipant

ZERO = Decimal("0.00")


def total_amount_owed(db: Session, user_id: int) -> Decimal:
    """Sum of amount_owed across every session the user participated in."""
    stmt = select(func.coalesce(func.sum(SessionParticipant.amount_owed), ZERO)).where(
        SessionParticipant.user_id == user_id
    )
    return db.execute(stmt).scalar_one()


def total_confirmed_payments(db: Session, user_id: int) -> Decimal:
    """Sum of only CONFIRMED payments made by the user."""
    stmt = select(func.coalesce(func.sum(Payment.amount), ZERO)).where(
        Payment.user_id == user_id,
        Payment.status == PaymentStatus.CONFIRMED,
    )
    return db.execute(stmt).scalar_one()


def calculate_user_balance(db: Session, user_id: int) -> Decimal:
    """
    Return the user's outstanding balance:

        total owed - total CONFIRMED payments

    Pending and rejected payments are excluded by construction.
    """
    owed = total_amount_owed(db, user_id)
    paid = total_confirmed_payments(db, user_id)
    return owed - paid
