"""
API routes for Step 5 Historical Payment Reconciliation.

Prefix: /api/reconciliation
Auth:   require_admin (ADMIN or SUPER_ADMIN)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.reconciliation import (
    PaymentWithRemainingRead,
    ReconciliationCreate,
    ReconciliationRead,
)
from app.services import reconciliation_service as svc

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])


# ---------------------------------------------------------------------------
# GET /api/reconciliation/eligible-payments
# ---------------------------------------------------------------------------


@router.get(
    "/eligible-payments",
    response_model=list[PaymentWithRemainingRead],
    summary="List confirmed payments eligible for reconciliation.",
)
def list_eligible_payments(
    actor: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """
    Return CONFIRMED payments the actor may reconcile, enriched with
    remaining_amount and reconciliation_status.

    SUPER_ADMIN: all confirmed payments.
    ADMIN: confirmed payments from users who participate in sessions
           assigned to this Admin.
    """
    return svc.get_eligible_historical_payments(db, actor)


# ---------------------------------------------------------------------------
# GET /api/reconciliation/payments/{payment_id}
# ---------------------------------------------------------------------------


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentWithRemainingRead,
    summary="Get payment detail with reconciliation accounting.",
)
def get_payment_detail(
    payment_id: int,
    actor: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Return a single payment enriched with total_allocated and remaining_amount."""
    try:
        return svc.get_payment_with_remaining(db, payment_id, actor)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /api/reconciliation/payments/{payment_id}/history
# ---------------------------------------------------------------------------


@router.get(
    "/payments/{payment_id}/history",
    response_model=list[ReconciliationRead],
    summary="List reconciliation history for a payment.",
)
def get_payment_history(
    payment_id: int,
    actor: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list:
    """
    Return all PaymentReconciliation audit records for a payment in
    chronological order, each including its allocations.

    Actor must be SUPER_ADMIN or the assigned handler of the payment.
    """
    try:
        return svc.get_reconciliation_history(db, payment_id, actor)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# POST /api/reconciliation/payments/{payment_id}/reconcile
# ---------------------------------------------------------------------------


@router.post(
    "/payments/{payment_id}/reconcile",
    response_model=ReconciliationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Manually reconcile a confirmed payment.",
)
def reconcile_payment(
    payment_id: int,
    body: ReconciliationCreate,
    actor: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> object:
    """
    Create a new PaymentReconciliation batch, allocating portions of the
    confirmed payment to one or more session participants.

    Rules enforced:
    - Payment must be CONFIRMED.
    - handler_id must match existing assignment (or is set on first reconciliation).
    - Each participant must belong to the payment's user.
    - Each participant's session must be assigned to handler_id.
    - Amounts must not exceed remaining debt or remaining payment amount.
    - Normal Admin can only reconcile as themselves (handler_id == actor.id).
    """
    try:
        allocations = [
            {
                "session_participant_id": a.session_participant_id,
                "amount": a.amount,
            }
            for a in body.allocations
        ]
        reconciliation = svc.create_reconciliation(
            db,
            payment_id=payment_id,
            handler_id=body.handler_id,
            actor=actor,
            allocations=allocations,
            notes=body.notes,
        )
        db.commit()
        return reconciliation
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /api/reconciliation/{reconciliation_id}
# ---------------------------------------------------------------------------


@router.get(
    "/{reconciliation_id}",
    response_model=ReconciliationRead,
    summary="Get a single reconciliation record.",
)
def get_reconciliation(
    reconciliation_id: int,
    actor: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> object:
    """
    Return a single PaymentReconciliation with its allocations.
    Actor must be SUPER_ADMIN or the handler_id of the reconciliation.
    """
    try:
        return svc.get_reconciliation_detail(db, reconciliation_id, actor)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )
