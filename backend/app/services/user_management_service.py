"""Business rules for super-admin role management."""

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.drink_session import DrinkSession
from app.models.enums import UserRole
from app.models.session_request import SessionRequest
from app.models.user import User


def change_user_role(
    db: Session,
    *,
    user_id: int,
    role: UserRole,
) -> User:
    """Change an account role while preserving a super-admin account."""
    if role == UserRole.SUPER_ADMIN:
        raise ValueError("Super-admin access is assigned only by bootstrap")

    # Lock the complete super-admin set in a stable order. Concurrent
    # demotions therefore serialize before the last-account check.
    super_admins = list(
        db.scalars(
            select(User)
            .where(User.role == UserRole.SUPER_ADMIN)
            .order_by(User.id)
            .with_for_update()
        ).all()
    )

    target = next(
        (account for account in super_admins if account.id == user_id),
        None,
    )
    if target is None:
        target = db.scalar(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
        )

    if target is None:
        raise LookupError("User not found")

    if (
        target.role == UserRole.SUPER_ADMIN
        and role != UserRole.SUPER_ADMIN
        and len(super_admins) <= 1
    ):
        raise LastSuperAdminError(
            "The last super-admin account cannot be demoted"
        )

    if target.role != role:
        if role == UserRole.USER:
            db.execute(
                update(DrinkSession)
                .where(DrinkSession.handler_id == target.id)
                .values(handler_id=None)
            )
            db.execute(
                update(SessionRequest)
                .where(SessionRequest.handler_id == target.id)
                .values(handler_id=None)
            )
        target.role = role

    db.flush()
    return target


class LastSuperAdminError(ValueError):
    """Raised when an operation would remove the final super-admin."""
