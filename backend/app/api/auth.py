"""
Authentication API endpoints.

Supports:
- Normal JSON login used by the React application.
- OAuth2-compatible login used by Swagger UI.
- Normal user registration.
- Admin-assisted password reset requests.

Both login methods return the same JWT access token.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import get_db
from app.models.password_reset import PasswordResetRequest
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequestCreate,
    TokenResponse,
    UserCreate,
    UserRead,
)
from app.services.password_reset_service import (
    request_password_reset,
    reset_password,
)
from app.services.user_service import (
    authenticate_user,
    create_user,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


# ============================================================================
# REGISTRATION
# ============================================================================


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Register a new normal USER account.

    New accounts are always created with the USER role.
    """

    try:
        user = create_user(
            db,
            name=user_data.name,
            password=user_data.password,
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
# NORMAL APPLICATION LOGIN
# ============================================================================


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate a user using JSON.

    This endpoint is used by the React application.
    """

    user = authenticate_user(
        db,
        name=login_data.name,
        password=login_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect name or password",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


# ============================================================================
# SWAGGER / OAUTH2 LOGIN
# ============================================================================


@router.post(
    "/token",
    response_model=TokenResponse,
)
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2-compatible login used by Swagger UI.

    Swagger sends:
        username
        password

    as form data rather than JSON.

    The username is mapped to the application's User.name field.
    """

    user = authenticate_user(
        db,
        name=form_data.username,
        password=form_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect name or password",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


# ============================================================================
# PASSWORD RESET REQUEST
# ============================================================================


@router.post(
    "/password-reset/request",
)
def password_reset_request(
    reset_data: PasswordResetRequestCreate,
    db: Session = Depends(get_db),
):
    """
    Submit an admin-assisted password reset request.

    The request must be approved by an administrator
    before a reset code can be generated.
    """

    try:
        reset_request = request_password_reset(
            db,
            name=reset_data.name,
        )

        db.commit()
        db.refresh(reset_request)

        return {
            "message": "Password reset request submitted",
            "request_id": reset_request.id,
        }

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ============================================================================
# PASSWORD RESET CONFIRMATION
# ============================================================================


@router.post(
    "/password-reset/confirm",
)
def password_reset_confirm(
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    """
    Reset a user's password using an approved one-time code.
    """

    reset_request = db.execute(
        select(PasswordResetRequest)
        .select_from(PasswordResetRequest)
        .join(
            User,
            PasswordResetRequest.user_id == User.id,
        )
        .where(
            User.name == reset_data.name.strip(),
            PasswordResetRequest.used.is_(False),
        )
        .order_by(
            PasswordResetRequest.created_at.desc()
        )
    ).scalars().first()

    if reset_request is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset request",
        )

    try:
        user = reset_password(
            db,
            reset_request=reset_request,
            code=reset_data.code,
            new_password=reset_data.new_password,
        )

        db.commit()

        return {
            "message": "Password reset successful",
            "user_id": user.id,
        }

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc