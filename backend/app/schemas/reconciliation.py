"""
Pydantic schemas for the Step 5 Historical Payment Reconciliation feature.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AllocationInput(BaseModel):
    """A single allocation within a reconciliation request."""

    session_participant_id: int
    amount: Decimal = Field(gt=0, decimal_places=2)


class ReconciliationCreate(BaseModel):
    """
    Request body for POST /api/reconciliation/payments/{payment_id}/reconcile.

    handler_id:  The Admin whose sessions this reconciliation targets.
    allocations: One or more session-participant allocations (non-empty).
    notes:       Optional free-text note stored on the reconciliation record.
    """

    handler_id: int
    allocations: list[AllocationInput] = Field(min_length=1)
    notes: str | None = None


class AllocationRead(BaseModel):
    """Serialised PaymentAllocation row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_id: int
    session_participant_id: int
    reconciliation_id: int | None
    amount: Decimal
    allocation_type: str
    allocated_by: int | None
    created_at: datetime


class ReconciliationRead(BaseModel):
    """Serialised PaymentReconciliation audit record with its allocations."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_id: int
    handler_id: int
    reconciled_by: int
    notes: str | None
    created_at: datetime
    allocations: list[AllocationRead]


class PaymentWithRemainingRead(BaseModel):
    """
    Payment summary enriched with reconciliation accounting.

    total_allocated:        Sum of all PaymentAllocation.amount for this payment.
    remaining_amount:       payment.amount - total_allocated (may be negative
                            only if legacy data exists; service layer enforces >= 0
                            for new allocations).
    reconciliation_status:  UNRECONCILED | PARTIAL | FULLY_RECONCILED
    handler_id:             Admin to whom this payment is currently assigned
                            (None if not yet reconciled).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    handler_id: int | None
    amount: Decimal
    status: str
    created_at: datetime
    confirmed_at: datetime | None
    confirmed_by: int | None

    total_allocated: Decimal
    remaining_amount: Decimal
    reconciliation_status: str
