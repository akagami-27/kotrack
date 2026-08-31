from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SessionParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str
    amount_owed: Decimal


class DrinkSessionCreate(BaseModel):
    """
    Input schema for creating a session.

    total_cost and amount_owed are never accepted from clients.
    They are calculated by the backend.
    """

    session_date: date

    packets_used: Decimal = Field(gt=0)

    participant_user_ids: list[int] = Field(min_length=1)

    price_per_packet: Decimal | None = Field(
        default=None,
        gt=0,
    )

    @field_validator("participant_user_ids")
    @classmethod
    def no_duplicate_participants(
        cls,
        value: list[int],
    ) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError(
                "participant_user_ids must not contain duplicates"
            )

        return value


class DrinkSessionUpdate(BaseModel):
    """
    Partial update schema for an existing drink session.

    total_cost and amount_owed are deliberately excluded.

    Any changed financial values are recalculated by the backend.
    """

    session_date: date | None = None

    packets_used: Decimal | None = Field(
        default=None,
        gt=0,
    )

    participant_user_ids: list[int] | None = Field(
        default=None,
        min_length=1,
    )

    price_per_packet: Decimal | None = Field(
        default=None,
        gt=0,
    )

    @field_validator("participant_user_ids")
    @classmethod
    def no_duplicate_participants(
        cls,
        value: list[int] | None,
    ) -> list[int] | None:
        if value is None:
            return value

        if len(set(value)) != len(value):
            raise ValueError(
                "participant_user_ids must not contain duplicates"
            )

        return value


class DrinkSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_date: date
    packets_used: Decimal
    price_per_packet: Decimal
    total_cost: Decimal
    created_by: int
    created_at: datetime

    participants: list[SessionParticipantRead] = Field(
        default_factory=list,
    )