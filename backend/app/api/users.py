from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    require_admin,
    require_super_admin,
)
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import (
    PasswordChangeRequest,
    UserRead,
    SuperAdminUserRead,
    UserRoleUpdate,
    UserUpdate,
)
from app.schemas.drink_session import SessionHandlerRead
from app.services.user_service import (
    change_password,
    remove_user_avatar,
    update_user_profile,
)
from app.services.password_reset_service import request_password_reset
from app.services.session_handler_service import (
    clear_session_handler_assignments,
)
from app.services.user_management_service import (
    LastSuperAdminError,
    change_user_role,
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

        if (
            "avatar_data" in profile_data.model_fields_set
            and profile_data.avatar_data is None
        ):
            user = remove_user_avatar(db, user=user)

        db.commit()
        db.refresh(user)

        return user

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/me/password-reset-request", status_code=status.HTTP_202_ACCEPTED)
def request_my_password_reset(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit an audited request bound to this browser's private cookie."""
    try:
        reset_request, session_value = request_password_reset(
            db,
            name=current_user.name,
            existing_session=request.cookies.get("kotrack_reset_session"),
        )
        db.commit()
        response.set_cookie(
            "kotrack_reset_session", session_value, max_age=86400,
            httponly=True, secure=True, samesite="strict",
            path="/api/auth/password-reset",
        )
        return {
            "message": "Password reset request submitted for Super Admin review.",
            "request_id": reset_request.id if reset_request else None,
        }
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Recovery is temporarily unavailable") from None


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


@router.get(
    "/session-handlers",
    response_model=list[SessionHandlerRead],
    tags=["Session Handlers"],
)
def get_session_handlers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return active administrators eligible to handle sessions."""
    del current_user
    return list(
        db.scalars(
            select(User)
            .where(
                User.is_active.is_(True),
                User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
            )
            .order_by(User.name.asc(), User.id.asc())
        ).all()
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

    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Super-admin accounts cannot be deactivated here",
        )

    user.is_active = False
    clear_session_handler_assignments(db, user_id=user.id)

    db.commit()
    db.refresh(user)

    return user


@router.get(
    "/super-admin/users",
    response_model=list[SuperAdminUserRead],
    tags=["Super-admin User Management"],
)
def super_admin_list_users(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """List limited account details for super-admins."""
    del current_user
    return list(
        db.scalars(select(User).order_by(User.name.asc(), User.id.asc())).all()
    )


@router.patch(
    "/super-admin/users/{user_id}/role",
    response_model=SuperAdminUserRead,
    tags=["Super-admin User Management"],
)
def super_admin_update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Promote to ADMIN or demote to USER; never allow public escalation."""
    del current_user
    try:
        user = change_user_role(
            db,
            user_id=user_id,
            role=role_update.role,
        )
        db.commit()
        db.refresh(user)
        return user
    except LookupError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except LastSuperAdminError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
