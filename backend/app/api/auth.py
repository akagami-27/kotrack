"""
Authentication API endpoints.

Supports:
- Normal JSON login used by the React application.
- OAuth2-compatible login used by Swagger UI.
- Normal user registration.

Both login methods return the same JWT access token.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import get_db
from app.schemas.user import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserRead,
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
                "WWW-Authenticate": "Bearer"
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
                "WWW-Authenticate": "Bearer"
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