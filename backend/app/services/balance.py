
"""
User and Admin-specific balance calculations.

Overall user balance:
    total amount owed across all sessions
    - total confirmed payments

Admin-specific session balance:
    amount owed in sessions assigned to the Admin
    - confirmed payment allocations to those sessions

All monetary calculations use Decimal.
"""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.drink_session import DrinkSession
from app.models.enums import PaymentStatus
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.session_participant import SessionParticipant


ZERO = Decimal("0.00")


# ---------------------------------------------------------
# EXISTING OVERALL USER BALANCE
# ---------------------------------------------------------

def total_amount_owed(db: Session, user_id: int) -> Decimal:
    """Sum amount owed across every session the user participated in."""
    stmt = select(
        func.coalesce(func.sum(SessionParticipant.amount_owed), ZERO)
    ).where(
        SessionParticipant.user_id == user_id
    )

    return db.execute(stmt).scalar_one()


def total_confirmed_payments(db: Session, user_id: int) -> Decimal:
    """Sum only CONFIRMED payments made by the user."""
    stmt = select(
        func.coalesce(func.sum(Payment.amount), ZERO)
    ).where(
        Payment.user_id == user_id,
        Payment.status == PaymentStatus.CONFIRMED,
    )

    return db.execute(stmt).scalar_one()


def calculate_user_balance(db: Session, user_id: int) -> Decimal:
    """
    Return the overall user balance.

    This existing calculation is intentionally unchanged.
    """
    owed = total_amount_owed(db, user_id)
    paid = total_confirmed_payments(db, user_id)

    return owed - paid


# ---------------------------------------------------------
# ADMIN-SPECIFIC SESSION BALANCE
# ---------------------------------------------------------

def total_amount_owed_for_handler(
    db: Session,
    user_id: int,
    handler_id: int,
) -> Decimal:
    """
    Sum the user's outstanding session charges for sessions
    assigned to the specified Admin.
    """
    stmt = (
        select(
            func.coalesce(
                func.sum(SessionParticipant.amount_owed),
                ZERO,
            )
        )
        .join(
            DrinkSession,
            DrinkSession.id == SessionParticipant.session_id,
        )
        .where(
            SessionParticipant.user_id == user_id,
            DrinkSession.handler_id == handler_id,
        )
    )

    return db.execute(stmt).scalar_one()


def total_allocated_for_handler(
    db: Session,
    user_id: int,
    handler_id: int,
) -> Decimal:
    """
    Sum confirmed payment allocations belonging to the user's
    sessions assigned to the specified Admin.

    Ownership is determined by DrinkSession.handler_id,
    not by Payment.handler_id or payment creator.
    """
    stmt = (
        select(
            func.coalesce(
                func.sum(PaymentAllocation.amount),
                ZERO,
            )
        )
        .join(
            SessionParticipant,
            SessionParticipant.id
            == PaymentAllocation.session_participant_id,
        )
        .join(
            DrinkSession,
            DrinkSession.id == SessionParticipant.session_id,
        )
        .join(
            Payment,
            Payment.id == PaymentAllocation.payment_id,
        )
        .where(
            SessionParticipant.user_id == user_id,
            DrinkSession.handler_id == handler_id,
            Payment.status == PaymentStatus.CONFIRMED,
        )
    )

    return db.execute(stmt).scalar_one()


def calculate_handler_balance(
    db: Session,
    user_id: int,
    handler_id: int,
) -> Decimal:
    """
    Calculate the user's remaining debt for sessions assigned
    to one specific Admin.

    Formula:
        session charges - confirmed allocations
    """
    owed = total_amount_owed_for_handler(
        db,
        user_id,
        handler_id,
    )

    allocated = total_allocated_for_handler(
        db,
        user_id,
        handler_id,
    )

    return owed - allocated
