"""
Admin API endpoints.

All endpoints in this module require an active ADMIN account.

Passwords and password hashes are never returned.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin, require_super_admin
from app.db.session import get_db
from app.models.password_reset import PasswordResetRequest
from app.models.user import User
from app.services.admin_service import get_admin_analytics
from app.services.password_reset_service import decide_password_reset


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

    return get_admin_analytics(db, current_user=current_user)


# ============================================================================
# PASSWORD RESET REQUESTS
# ============================================================================


@router.get("/password-reset-requests")
def get_password_reset_requests(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Return pending password-reset requests.

    No credentials or browser session material are returned.
    """

    requests = db.execute(
        select(PasswordResetRequest)
        .where(
            PasswordResetRequest.status == "PENDING",
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
            "status": reset_request.status,
        }
        for reset_request in requests
    ]


@router.post("/password-reset-requests/{request_id}/approve")
def approve_password_reset_request(
    request_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Approve a pending password-reset request.

    Authorizes the request-bound browser session after identity review.
    """

    reset_request = db.execute(
        select(PasswordResetRequest).where(
            PasswordResetRequest.id == request_id,
            PasswordResetRequest.status == "PENDING",
        )
    ).scalar_one_or_none()

    if reset_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Password reset request not found",
        )

    if reset_request.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot approve their own password reset requests",
        )

    if not reset_request.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive",
        )

    try:
        reset_request = decide_password_reset(db, request_id=request_id, admin=current_user, approve=True)

        db.commit()

        return {
            "message": "Password reset approved",
            "request_id": reset_request.id,
            "username": reset_request.user.name,
            "status": reset_request.status,
        }

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/password-reset-requests/{request_id}/reject")
def reject_password_reset_request(
    request_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Reject a pending request and retain administrator audit metadata."""
    reset_request = db.execute(
        select(PasswordResetRequest).where(
            PasswordResetRequest.id == request_id,
            PasswordResetRequest.status == "PENDING",
        )
    ).scalar_one_or_none()

    if reset_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending password reset request not found",
        )

    if reset_request.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot reject their own password reset requests",
        )

    try:
        reset_request = decide_password_reset(db, request_id=request_id, admin=current_user, approve=False)
        db.commit()
        return {
            "message": "Password reset request rejected",
            "request_id": reset_request.id,
            "status": "REJECTED",
            "rejected_by": current_user.id,
            "rejected_at": reset_request.rejected_at,
        }
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
