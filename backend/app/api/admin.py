"""
Admin API endpoints.

All endpoints in this module require an active ADMIN account.

Passwords and password hashes are never returned.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.password_reset import PasswordResetRequest
from app.models.user import User
from app.services.admin_service import get_admin_analytics
from app.services.password_reset_service import approve_password_reset


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


@router.get("/analytics")
def get_admin_analytics_endpoint(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return financial and usage analytics for the admin dashboard.
    """

    return get_admin_analytics(db)


# ============================================================================
# PASSWORD RESET REQUESTS
# ============================================================================


@router.get("/password-reset-requests")
def get_password_reset_requests(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return pending password-reset requests.

    Passwords, password hashes, and reset-code hashes are never returned.
    """

    requests = db.execute(
        select(PasswordResetRequest)
        .where(
            PasswordResetRequest.used.is_(False),
        )
        .order_by(
            PasswordResetRequest.created_at.asc()
        )
    ).scalars().all()

    return [
        {
            "id": reset_request.id,
            "user_id": reset_request.user_id,
            "username": reset_request.user.name,
            "created_at": reset_request.created_at,
            "approved_at": reset_request.approved_at,
            "expires_at": reset_request.expires_at,
        }
        for reset_request in requests
    ]


@router.post("/password-reset-requests/{request_id}/approve")
def approve_password_reset_request(
    request_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Approve a pending password-reset request.

    Generates a secure one-time reset code for the administrator
    to provide directly to the verified user.
    """

    reset_request = db.execute(
        select(PasswordResetRequest).where(
            PasswordResetRequest.id == request_id,
            PasswordResetRequest.used.is_(False),
        )
    ).scalar_one_or_none()

    if reset_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Password reset request not found",
        )

    if not reset_request.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive",
        )

    try:
        code = approve_password_reset(
            db,
            reset_request=reset_request,
            admin=current_user,
        )

        db.commit()

        return {
            "message": "Password reset approved",
            "request_id": reset_request.id,
            "username": reset_request.user.name,
            "code": code,
            "expires_at": reset_request.expires_at,
        }

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc