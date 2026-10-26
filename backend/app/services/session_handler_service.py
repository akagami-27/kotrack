"""Validation and cleanup for assigned session handlers."""

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.drink_session import DrinkSession
from app.models.enums import UserRole
from app.models.session_request import SessionRequest
from app.models.user import User


def validate_session_handler(
    db: Session,
    handler_id: int | None,
) -> User | None:
    """Return an eligible active admin or reject an invalid assignment."""
    if handler_id is None:
        return None

    handler = db.scalar(
        select(User).where(User.id == handler_id)
    )
    if handler is None or not handler.is_active:
        raise ValueError("Selected session handler is unavailable")
    if handler.role not in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise ValueError("Selected session handler must be an administrator")
    return handler


def clear_session_handler_assignments(
    db: Session,
    *,
    user_id: int,
) -> None:
    """Clear assignments when an account becomes ineligible to handle sessions."""
    db.execute(
        update(DrinkSession)
        .where(DrinkSession.handler_id == user_id)
        .values(handler_id=None)
    )
    db.execute(
        update(SessionRequest)
        .where(SessionRequest.handler_id == user_id)
        .values(handler_id=None)
    )
