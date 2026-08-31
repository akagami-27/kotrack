"""
Payment API endpoints.

Users can submit and view their own payments.
Administrators can review, confirm, reject, and download receipts.

Receipt files:
- Any file type is accepted.
- Maximum file size: 25 MB.
- Receipt bytes are stored in the database.
- SHA-256 is stored for integrity verification.
- Uploaded files are never executed by the application.

Business rules are handled by app.services.payment_service.
"""

import hashlib
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.enums import PaymentStatus
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentRead
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
# RECEIPT SETTINGS
# ============================================================================

MAX_RECEIPT_SIZE = 25 * 1024 * 1024  # 25 MB
RECEIPT_READ_CHUNK_SIZE = 1024 * 1024  # 1 MB


# ============================================================================
# USER PAYMENT ENDPOINTS
# ============================================================================


@router.post(
    "",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
)
async def submit_payment(
    amount: str = Form(...),
    receipt: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a payment with a receipt.

    The payment always starts as PENDING.

    The user cannot choose or modify the payment status.

    Receipt:
        - Any file type is accepted.
        - Maximum size is 25 MB.
        - Original filename is preserved.
        - Content type is preserved.
        - SHA-256 hash is calculated.
    """

    # ------------------------------------------------------------------------
    # Validate amount
    # ------------------------------------------------------------------------

    from decimal import Decimal, InvalidOperation

    try:
        payment_amount = Decimal(amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment amount",
        )

    if payment_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero",
        )

    # ------------------------------------------------------------------------
    # Validate receipt
    # ------------------------------------------------------------------------

    if receipt.filename is None or not receipt.filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt file is required",
        )

    filename = receipt.filename.strip()

    if len(filename) > 255:
        filename = filename[:255]

    # ------------------------------------------------------------------------
    # Read receipt safely
    # ------------------------------------------------------------------------

    receipt_chunks: list[bytes] = []
    total_size = 0
    sha256 = hashlib.sha256()

    try:
        while True:
            chunk = await receipt.read(
                RECEIPT_READ_CHUNK_SIZE
            )

            if not chunk:
                break

            total_size += len(chunk)

            if total_size > MAX_RECEIPT_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Receipt file must not exceed 25 MB",
                )

            receipt_chunks.append(chunk)
            sha256.update(chunk)

    finally:
        await receipt.close()

    if total_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt file cannot be empty",
        )

    receipt_data = b"".join(receipt_chunks)

    receipt_hash = sha256.hexdigest()

    content_type = (
        receipt.content_type
        if receipt.content_type
        else "application/octet-stream"
    )

    # ------------------------------------------------------------------------
    # Create payment
    # ------------------------------------------------------------------------

    try:
        payment = create_payment(
            db,
            user_id=current_user.id,
            amount=payment_amount,
        )

        # --------------------------------------------------------------------
        # Attach receipt
        # --------------------------------------------------------------------

        payment.receipt_data = receipt_data
        payment.receipt_filename = filename
        payment.receipt_content_type = content_type
        payment.receipt_file_size = total_size
        payment.receipt_sha256 = receipt_hash
        payment.receipt_uploaded_at = datetime.now(
            timezone.utc
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

    except Exception:
        db.rollback()
        raise


# ============================================================================
# USER PAYMENT LIST
# ============================================================================


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
# RECEIPT DOWNLOAD
# ============================================================================


@router.get(
    "/{payment_id}/receipt",
)
def download_payment_receipt(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download a payment receipt.

    USER:
        Can only download their own receipt.

    ADMIN:
        Can download any payment receipt.
    """

    payment = db.scalar(
        select(Payment).where(
            Payment.id == payment_id
        )
    )

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # ------------------------------------------------------------------------
    # Authorization
    # ------------------------------------------------------------------------

    if (
        current_user.role.value != "ADMIN"
        and payment.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # ------------------------------------------------------------------------
    # Receipt existence
    # ------------------------------------------------------------------------

    if payment.receipt_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found",
        )

    filename = (
        payment.receipt_filename
        or "payment-receipt"
    )

    content_type = (
        payment.receipt_content_type
        or "application/octet-stream"
    )

    return Response(
        content=payment.receipt_data,
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
            "X-Receipt-SHA256": (
                payment.receipt_sha256 or ""
            ),
        },
    )


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


# ============================================================================
# CONFIRM PAYMENT
# ============================================================================


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


# ============================================================================
# REJECT PAYMENT
# ============================================================================


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