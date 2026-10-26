"""Authorization helpers for session-scoped administrator access."""

from sqlalchemy import exists, select

from app.models.drink_session import DrinkSession
from app.models.enums import UserRole
from app.models.session_participant import SessionParticipant
from app.models.user import User


def visible_sessions_for(user: User):
    """Return a SQL predicate enforcing the caller's session visibility."""
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.role == UserRole.ADMIN:
        return DrinkSession.handler_id == user.id
    return exists(
        select(SessionParticipant.id).where(
            SessionParticipant.session_id == DrinkSession.id,
            SessionParticipant.user_id == user.id,
        )
    )


def admin_can_access_session(session: DrinkSession, user: User) -> bool:
    """Check the session assignment rule for administrator mutations."""
    if user.role == UserRole.SUPER_ADMIN:
        return True
    return (
        user.role == UserRole.ADMIN
        and session.handler_id == user.id
    )
