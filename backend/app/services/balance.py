
"""
User and Admin-specific balance calculations.

Overall user balance:
    sum of handler-scoped session debt after confirmed allocations

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
from app.models.user import User


ZERO = Decimal("0.00")


# ---------------------------------------------------------
# OVERALL USER BALANCE
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
    """Return total remaining debt using the shared allocation-based ledger."""
    return user_outstanding_by_handler(db, user_id)["total_outstanding"]


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
    breakdown = user_outstanding_by_handler(db, user_id)
    return next(
        (
            item["outstanding"]
            for item in breakdown["admins"]
            if item["admin_id"] == handler_id
        ),
        ZERO,
    )


def user_outstanding_by_handler(db: Session, user_id: int) -> dict:
    """Return the user's remaining session debt grouped by session handler.

    Session ownership comes from ``DrinkSession.handler_id``. Only confirmed
    allocations to this user's own session-participant rows reduce the amount.
    """
    owed_rows = db.execute(
        select(
            DrinkSession.handler_id.label("handler_id"),
            User.name.label("handler_name"),
            func.coalesce(
                func.sum(SessionParticipant.amount_owed), ZERO
            ).label("owed"),
        )
        .join(
            SessionParticipant,
            SessionParticipant.session_id == DrinkSession.id,
        )
        .outerjoin(User, User.id == DrinkSession.handler_id)
        .where(SessionParticipant.user_id == user_id)
        .group_by(DrinkSession.handler_id, User.name)
    ).all()

    allocated_rows = db.execute(
        select(
            DrinkSession.handler_id.label("handler_id"),
            func.coalesce(
                func.sum(PaymentAllocation.amount), ZERO
            ).label("allocated"),
        )
        .join(
            SessionParticipant,
            SessionParticipant.session_id == DrinkSession.id,
        )
        .join(
            PaymentAllocation,
            PaymentAllocation.session_participant_id == SessionParticipant.id,
        )
        .join(Payment, Payment.id == PaymentAllocation.payment_id)
        .where(
            SessionParticipant.user_id == user_id,
            Payment.status == PaymentStatus.CONFIRMED,
        )
        .group_by(DrinkSession.handler_id)
    ).all()

    allocated_by_handler = {
        row.handler_id: Decimal(row.allocated)
        for row in allocated_rows
    }
    admins = []
    for row in owed_rows:
        outstanding = max(
            Decimal(row.owed) - allocated_by_handler.get(row.handler_id, ZERO),
            ZERO,
        )
        admins.append({
            "admin_id": row.handler_id,
            "admin_name": row.handler_name or "Unassigned",
            "outstanding": outstanding,
        })

    admins.sort(key=lambda item: item["admin_name"].casefold())
    return {
        "total_outstanding": sum(
            (item["outstanding"] for item in admins), ZERO
        ),
        "admins": admins,
    }
