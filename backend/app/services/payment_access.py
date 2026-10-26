"""Authorization helpers for admin access to participant payments."""

from sqlalchemy import exists, or_, select
from sqlalchemy.orm import aliased

from app.models.drink_session import DrinkSession
from app.models.enums import UserRole
from app.models.payment import Payment
from app.models.session_participant import SessionParticipant
from app.models.user import User


def payments_visible_to(user: User):
    """Limit admins to payments by users in their assigned sessions."""
    if user.role == UserRole.SUPER_ADMIN:
        return True
    foreign_participant = aliased(SessionParticipant)
    foreign_session = aliased(DrinkSession)
    owns_participant = exists(
        select(SessionParticipant.id)
        .join(DrinkSession, DrinkSession.id == SessionParticipant.session_id)
        .where(
            SessionParticipant.user_id == Payment.user_id,
            DrinkSession.handler_id == user.id,
        )
    )
    has_other_handler = exists(
        select(foreign_participant.id)
        .join(
            foreign_session,
            foreign_session.id == foreign_participant.session_id,
        )
        .where(
            foreign_participant.user_id == Payment.user_id,
            or_(
                foreign_session.handler_id.is_(None),
                foreign_session.handler_id != user.id,
            ),
        )
    )
    return owns_participant & ~has_other_handler


def handled_payment_user_ids(handler_id: int):
    """Return users whose assigned sessions belong exclusively to one admin."""
    foreign_participant = aliased(SessionParticipant)
    foreign_session = aliased(DrinkSession)
    has_other_handler = exists(
        select(foreign_participant.id)
        .join(
            foreign_session,
            foreign_session.id == foreign_participant.session_id,
        )
        .where(
            foreign_participant.user_id == SessionParticipant.user_id,
            or_(
                foreign_session.handler_id.is_(None),
                foreign_session.handler_id != handler_id,
            ),
        )
    )
    return (
        select(SessionParticipant.user_id)
        .join(DrinkSession, DrinkSession.id == SessionParticipant.session_id)
        .where(
            DrinkSession.handler_id == handler_id,
            ~has_other_handler,
        )
    )
