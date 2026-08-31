from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentStatus


class PaymentCreate(BaseModel):
    """
    Input schema for a user submitting a payment.

    `status` is deliberately absent -- every new payment always starts as
    PENDING; only an admin confirmation flow (not yet implemented) may move
    it to CONFIRMED or REJECTED.
    """
    amount: Decimal = Field(gt=0)


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    amount: Decimal
    status: PaymentStatus
    created_at: datetime
    confirmed_at: datetime | None
    confirmed_by: int | None


class UserBalanceRead(BaseModel):
    user_id: int
    total_owed: Decimal
    total_confirmed_payments: Decimal
    balance: Decimal
