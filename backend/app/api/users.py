from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    PasswordChangeRequest,
    UserRead,
    UserUpdate,
)
from app.services.user_service import (
    change_password,
    update_user_profile,
)


router = APIRouter(
    prefix="/api/users",
    tags=["Users"],
)


# ============================================================================
# CURRENT USER
# ============================================================================


@router.get(
    "/me",
    response_model=UserRead,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user's profile."""

    return current_user


@router.patch(
    "/me",
    response_model=UserRead,
)
def update_my_profile(
    profile_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's profile."""

    try:
        user = update_user_profile(
            db,
            user=current_user,
            name=profile_data.name,
            avatar_data=profile_data.avatar_data,
        )

        db.commit()
        db.refresh(user)

        return user

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/me/password",
    response_model=UserRead,
)
def change_my_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the authenticated user's password."""

    try:
        user = change_password(
            db,
            user=current_user,
            current_password=password_data.current_password,
            new_password=password_data.new_password,
        )

        db.commit()
        db.refresh(user)

        return user

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ============================================================================
# USER LIST
# ============================================================================


@router.get(
    "",
    response_model=list[UserRead],
)
def get_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return all active users.

    Any authenticated user can see the public user list.
    Password hashes are never returned by UserRead.
    """

    stmt = (
        select(User)
        .where(User.is_active.is_(True))
        .order_by(User.name.asc())
    )

    return list(
        db.scalars(stmt).all()
    )


# ============================================================================
# ADMIN USER MANAGEMENT
# ============================================================================


@router.get(
    "/admin/all",
    response_model=list[UserRead],
)
def admin_get_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return every user, including inactive users.

    ADMIN only.

    Password hashes are never returned.
    """

    stmt = (
        select(User)
        .order_by(User.name.asc())
    )

    return list(
        db.scalars(stmt).all()
    )


@router.patch(
    "/admin/{user_id}/activate",
    response_model=UserRead,
)
def admin_activate_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Activate a user account.

    ADMIN only.
    """

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = True

    db.commit()
    db.refresh(user)

    return user


@router.patch(
    "/admin/{user_id}/deactivate",
    response_model=UserRead,
)
def admin_deactivate_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Deactivate a user account.

    ADMIN only.

    An administrator cannot deactivate their own account.
    """

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own admin account",
        )

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = False

    db.commit()
    db.refresh(user)

    return user