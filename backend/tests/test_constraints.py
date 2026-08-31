"""
Tests for database-level integrity constraints (not just application logic).
These make sure the constraints actually exist in the schema, not just in
Python-side validation.
"""
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.drink_session import DrinkSession
from app.models.enums import UserRole
from app.models.session_participant import SessionParticipant
from app.models.user import User


def make_user(db, name="Test User") -> User:
    user = User(name=name, password_hash="hash", role=UserRole.USER)
    db.add(user)
    db.flush()
    return user


def test_user_cannot_appear_twice_in_same_session(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")

    session = DrinkSession(
        session_date=date(2026, 1, 1),
        packets_used=Decimal("1"),
        price_per_packet=Decimal("25.00"),
        total_cost=Decimal("25.00"),
        created_by=creator.id,
    )
    db.add(session)
    db.flush()

    db.add(SessionParticipant(session_id=session.id, user_id=bob.id, amount_owed=Decimal("12.50")))
    db.flush()

    # Same user, same session again -> must violate the unique constraint.
    db.add(SessionParticipant(session_id=session.id, user_id=bob.id, amount_owed=Decimal("12.50")))
    with pytest.raises(IntegrityError):
        db.flush()


def test_deleting_session_cascades_to_participants(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")

    session = DrinkSession(
        session_date=date(2026, 1, 1),
        packets_used=Decimal("1"),
        price_per_packet=Decimal("25.00"),
        total_cost=Decimal("25.00"),
        created_by=creator.id,
    )
    session.participants = [
        SessionParticipant(user_id=bob.id, amount_owed=Decimal("25.00"))
    ]
    db.add(session)
    db.flush()
    session_id = session.id

    db.delete(session)
    db.flush()

    remaining = (
        db.query(SessionParticipant)
        .filter(SessionParticipant.session_id == session_id)
        .all()
    )
    assert remaining == []
