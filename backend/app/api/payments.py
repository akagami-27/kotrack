"""
Payment API endpoints.

Users can submit and view their own payments.
Administrators can review, confirm, or reject payments.

Business rules are handled by app.services.payment_service.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.enums import PaymentStatus
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentRead
from app.services.payment_service import (
    confirm_payment,
    create_payment,
    reject_payment,
)


router = APIRouter(
    prefix="/api/payments",
    tags=["Payments"],
)


# ============================================================================
# USER PAYMENT ENDPOINTS
# ============================================================================


@router.post(
    "",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a payment for the authenticated user.

    New payments always start as PENDING.
    Users cannot choose or modify the payment status.
    """

    try:
        payment = create_payment(
            db,
            user_id=current_user.id,
            amount=payment_data.amount,
        )

        db.commit()
        db.refresh(payment)

        return payment

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/me",
    response_model=list[PaymentRead],
)
def list_my_payments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return payments belonging only to the authenticated user.
    """

    return db.scalars(
        select(Payment)
        .where(
            Payment.user_id == current_user.id
        )
        .order_by(
            Payment.created_at.desc()
        )
    ).all()


# ============================================================================
# ADMIN PAYMENT ENDPOINTS
# ============================================================================


@router.get(
    "",
    response_model=list[PaymentRead],
)
def list_all_payments(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return all payments.

    ADMIN only.
    """

    return db.scalars(
        select(Payment)
        .order_by(
            Payment.created_at.desc()
        )
    ).all()


@router.get(
    "/admin/pending",
    response_model=list[PaymentRead],
)
def list_pending_payments(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return all pending payments.

    ADMIN only.
    """

    return db.scalars(
        select(Payment)
        .where(
            Payment.status == PaymentStatus.PENDING
        )
        .order_by(
            Payment.created_at.asc()
        )
    ).all()


@router.patch(
    "/{payment_id}/confirm",
    response_model=PaymentRead,
)
def confirm_payment_endpoint(
    payment_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Confirm a pending payment.

    ADMIN only.

    Once confirmed, the payment is included in the
    user's balance calculation.
    """

    try:
        payment = confirm_payment(
            db,
            payment_id=payment_id,
            admin_user_id=admin.id,
        )

        return payment

    except PermissionError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.patch(
    "/{payment_id}/reject",
    response_model=PaymentRead,
)
def reject_payment_endpoint(
    payment_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reject a pending payment.

    ADMIN only.

    Rejected payments do not affect the user's balance.
    """

    try:
        payment = reject_payment(
            db,
            payment_id=payment_id,
            admin_user_id=admin.id,
        )

        return payment

    except PermissionError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc