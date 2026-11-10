from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentStatus


class PaymentCreate(BaseModel):
    """
    Input schema for a user submitting a payment.

    Receipt files are uploaded separately using multipart/form-data.
    The payment status is never controlled by the user.
    """

    amount: Decimal = Field(gt=0)


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    handler_id: int | None
    amount: Decimal
    status: PaymentStatus

    created_at: datetime

    confirmed_at: datetime | None
    confirmed_by: int | None

    # Receipt information
    receipt_filename: str | None
    receipt_content_type: str | None
    receipt_file_size: int | None
    receipt_sha256: str | None
    receipt_uploaded_at: datetime | None


class AdminOutstandingRead(BaseModel):
    admin_id: int | None
    admin_name: str
    outstanding: Decimal


class UserBalanceRead(BaseModel):
    user_id: int
    total_owed: Decimal
    total_confirmed_payments: Decimal
    balance: Decimal
    outstanding_by_admin: list[AdminOutstandingRead]


class UserOutstandingBreakdownRead(BaseModel):
    total_outstanding: Decimal
    admins: list[AdminOutstandingRead]
