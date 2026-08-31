from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SessionRequestCreate(BaseModel):
    session_date: date
    packets_used: Decimal = Field(gt=0)
    participant_user_ids: list[int] = Field(min_length=1)
    note: str | None = None


class SessionRequestParticipantRead(BaseModel):
    user_id: int
    user_name: str

    model_config = ConfigDict(from_attributes=True)


class SessionRequestRead(BaseModel):
    id: int
    requested_by: int
    session_date: date
    packets_used: Decimal
    note: str | None
    status: str
    created_at: datetime
    reviewed_at: datetime | None
    reviewed_by: int | None
    participants: list[SessionRequestParticipantRead]

    model_config = ConfigDict(from_attributes=True)