from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.drink_session import DrinkSessionCreate
from app.schemas.payment import PaymentCreate


def test_drink_session_accepts_valid_input():
    session = DrinkSessionCreate(
        session_date=date(2026, 8, 28),
        packets_used=Decimal("1.5"),
        participant_user_ids=[1, 2, 3],
        price_per_packet=Decimal("25.00"),
    )

    assert session.packets_used == Decimal("1.5")
    assert session.participant_user_ids == [1, 2, 3]


def test_drink_session_rejects_zero_packets():
    with pytest.raises(ValidationError):
        DrinkSessionCreate(
            session_date=date(2026, 8, 28),
            packets_used=Decimal("0"),
            participant_user_ids=[1],
        )


def test_drink_session_rejects_duplicate_participants():
    with pytest.raises(ValidationError):
        DrinkSessionCreate(
            session_date=date(2026, 8, 28),
            packets_used=Decimal("1"),
            participant_user_ids=[1, 2, 2],
        )


def test_drink_session_requires_participant():
    with pytest.raises(ValidationError):
        DrinkSessionCreate(
            session_date=date(2026, 8, 28),
            packets_used=Decimal("1"),
            participant_user_ids=[],
        )


def test_payment_accepts_positive_amount():
    payment = PaymentCreate(
        amount=Decimal("10.00"),
    )

    assert payment.amount == Decimal("10.00")


def test_payment_rejects_zero_amount():
    with pytest.raises(ValidationError):
        PaymentCreate(
            amount=Decimal("0"),
        )


def test_payment_rejects_negative_amount():
    with pytest.raises(ValidationError):
        PaymentCreate(
            amount=Decimal("-5.00"),
        )