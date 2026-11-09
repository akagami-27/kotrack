
"""Validation and cleanup for assigned session handlers."""

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.drink_session import DrinkSession
from app.models.enums import UserRole
from app.models.session_request import SessionRequest
from app.models.user import User


def get_default_session_handler(db: Session) -> User:
    """Return the single active Super Admin used for unassigned sessions."""

    super_admins = db.scalars(
        select(User).where(
            User.role == UserRole.SUPER_ADMIN,
            User.is_active.is_(True),
        )
    ).all()

    if not super_admins:
        raise ValueError(
            "No active Super Admin is available to handle this session"
        )

    if len(super_admins) > 1:
        raise ValueError(
            "Multiple active Super Admin accounts found. "
            "A single default session handler must be configured."
        )

    return super_admins[0]


def validate_session_handler(
    db: Session,
    handler_id: int | None,
) -> User:
    """
    Return an eligible active session handler.

    If no handler is supplied, use the single active Super Admin.
    Explicitly assigned Admins and Super Admins are preserved.
    """

    if handler_id is None:
        return get_default_session_handler(db)

    handler = db.scalar(
        select(User).where(User.id == handler_id)
    )

    if handler is None or not handler.is_active:
        raise ValueError("Selected session handler is unavailable")

    if handler.role not in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise ValueError(
            "Selected session handler must be an administrator"
        )

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
