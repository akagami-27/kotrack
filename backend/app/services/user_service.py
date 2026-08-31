"""
User account business logic.

Handles user creation, profile updates, password changes,
and authentication.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User


def create_user(
    db: Session,
    *,
    name: str,
    password: str,
) -> User:
    """Create a normal USER account."""

    name = name.strip()

    if not name:
        raise ValueError("Name cannot be empty")

    existing_user = db.execute(
        select(User).where(User.name == name)
    ).scalar_one_or_none()

    if existing_user is not None:
        raise ValueError(
            "A user with this name already exists"
        )

    user = User(
        name=name,
        password_hash=hash_password(password),
        role=UserRole.USER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def update_user_profile(
    db: Session,
    *,
    user: User,
    name: str | None = None,
    avatar_data: str | None = None,
) -> User:
    """
    Update allowed profile fields.

    Important:
    The API layer determines whether avatar_data was supplied.

    If avatar_data is not None, it is treated as a new avatar.
    """

    # ----------------------------------------------------------------------
    # NAME
    # ----------------------------------------------------------------------

    if name is not None:
        name = name.strip()

        if not name:
            raise ValueError(
                "Name cannot be empty"
            )

        existing_user = db.execute(
            select(User).where(
                User.name == name,
                User.id != user.id,
            )
        ).scalar_one_or_none()

        if existing_user is not None:
            raise ValueError(
                "A user with this name already exists"
            )

        user.name = name

    # ----------------------------------------------------------------------
    # AVATAR
    # ----------------------------------------------------------------------

    if avatar_data is not None:

        if not avatar_data.startswith(
            "data:image/webp;base64,"
        ):
            raise ValueError(
                "Avatar must be a compressed WebP image"
            )

        if len(avatar_data) > 500_000:
            raise ValueError(
                "Avatar image is too large"
            )

        user.avatar_data = avatar_data

    db.flush()

    return user


def remove_user_avatar(
    db: Session,
    *,
    user: User,
) -> User:
    """Remove the authenticated user's avatar."""

    user.avatar_data = None

    db.flush()

    return user


def change_password(
    db: Session,
    *,
    user: User,
    current_password: str,
    new_password: str,
) -> User:
    """Change a user's password."""

    if not verify_password(
        current_password,
        user.password_hash,
    ):
        raise ValueError(
            "Current password is incorrect"
        )

    if len(new_password) < 8:
        raise ValueError(
            "New password must be at least 8 characters"
        )

    if current_password == new_password:
        raise ValueError(
            "New password must be different from current password"
        )

    user.password_hash = hash_password(
        new_password
    )

    db.flush()

    return user


def authenticate_user(
    db: Session,
    *,
    name: str,
    password: str,
) -> User | None:
    """Authenticate an active user."""

    name = name.strip()

    user = db.execute(
        select(User).where(User.name == name)
    ).scalar_one_or_none()

    if user is None:
        return None

    if not user.is_active:
        return None

    if not verify_password(
        password,
        user.password_hash,
    ):
        return None

    return user