"""
Authentication API endpoints.

Supports:
- Normal JSON login used by the React application.
- OAuth2-compatible login used by Swagger UI.
- Normal user registration.
- Admin-assisted password reset requests.

Both login methods return the same JWT access token.
"""

import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    PasswordResetRequestCreate,
    TokenResponse,
    UserCreate,
    UserRead,
)
from app.services.password_reset_service import complete_password_reset, request_password_reset
from app.services.user_service import (
    authenticate_user,
    create_user,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

logger = logging.getLogger(__name__)


def _authenticate_or_unavailable(
    db: Session,
    *,
    name: str,
    password: str,
) -> User | None:
    """Authenticate without returning database diagnostics to the caller."""
    try:
        return authenticate_user(db, name=name, password=password)
    except SQLAlchemyError as exc:
        try:
            db.rollback()
        except SQLAlchemyError as rollback_exc:
            logger.error(
                "Authentication database rollback failed (%s)",
                type(rollback_exc).__name__,
            )
        # Exception text can contain query details or connection metadata.
        logger.error(
            "Authentication database operation failed (%s)",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable",
            headers={"Retry-After": "30"},
        ) from None


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

    user = _authenticate_or_unavailable(
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

    user = _authenticate_or_unavailable(
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


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def password_reset_request(
    reset_data: PasswordResetRequestCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Submit a non-enumerating recovery request and set a private browser cookie."""
    try:
        _, session_value = request_password_reset(
            db, name=reset_data.name,
            existing_session=request.cookies.get("kotrack_reset_session"),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Recovery is temporarily unavailable") from None
    response.set_cookie(
        "kotrack_reset_session", session_value, max_age=7200, httponly=True,
        secure=True, samesite="strict",
        path="/api/auth/password-reset",
    )
    return {"message": "If the account is eligible, the request has been recorded for review."}


@router.get("/password-reset/status")
def password_reset_status(
    kotrack_reset_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone
    from hashlib import sha256
    from sqlalchemy import select
    from app.models.password_reset import PasswordResetRequest
    if not kotrack_reset_session:
        return {"status": "UNAVAILABLE"}
    digest = sha256(kotrack_reset_session.encode()).hexdigest()
    row = db.execute(select(PasswordResetRequest.status, PasswordResetRequest.session_expires_at).where(
        PasswordResetRequest.reset_session_hash == digest,
    )).first()
    if row is None or row.session_expires_at is None:
        return {"status": "UNAVAILABLE"}
    expiry = row.session_expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return {"status": row.status if expiry > datetime.now(timezone.utc) else "EXPIRED"}


from pydantic import BaseModel, Field


class PasswordResetComplete(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/password-reset/complete")
def password_reset_complete(
    reset_data: PasswordResetComplete,
    response: Response,
    kotrack_reset_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not kotrack_reset_session:
        raise HTTPException(status_code=400, detail="No valid reset session")
    try:
        complete_password_reset(db, raw_session=kotrack_reset_session, new_password=reset_data.new_password)
        db.commit()
        response.delete_cookie("kotrack_reset_session", path="/api/auth/password-reset", httponly=True, samesite="strict")
        return {"message": "Password reset completed"}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
