"""
Integration tests covering:

  - Session creation with server-computed total_cost / amount_owed
  - Multiple sessions per user
  - Partial payments
  - Pending / confirmed / rejected payment handling
  - Balance calculation (owed - CONFIRMED payments only)

These require a real Postgres database (see tests/conftest.py).
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from app.models.enums import PaymentStatus, UserRole
from app.models.payment import Payment
from app.models.user import User
from app.services.balance import calculate_user_balance
from app.services.session_service import create_drink_session


def make_user(db, name="Test User", role=UserRole.USER) -> User:
    user = User(name=name, password_hash="not-a-real-hash", role=role)
    db.add(user)
    db.flush()
    return user


def test_session_creation_computes_total_and_splits_server_side(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")
    carol = make_user(db, "Carol")

    session = create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("1.5"),
        participant_user_ids=[creator.id, bob.id, carol.id],
        created_by=creator.id,
        commit=False,
    )
    db.flush()

    assert session.total_cost == Decimal("37.50")
    assert sum(p.amount_owed for p in session.participants) == Decimal("37.50")
    assert {p.user_id for p in session.participants} == {creator.id, bob.id, carol.id}


def test_balance_with_no_activity_is_zero(db):
    user = make_user(db)
    db.flush()
    assert calculate_user_balance(db, user.id) == Decimal("0.00")


def test_balance_reflects_owed_amount_with_no_payments(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")

    session = create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("2"),
        participant_user_ids=[creator.id, bob.id],
        created_by=creator.id,
        commit=False,
    )
    db.flush()

    bob_owed = next(p.amount_owed for p in session.participants if p.user_id == bob.id)
    assert calculate_user_balance(db, bob.id) == bob_owed


def test_pending_payment_does_not_reduce_balance(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")

    create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("2"),
        participant_user_ids=[creator.id, bob.id],
        created_by=creator.id,
        commit=False,
    )
    db.flush()

    balance_before = calculate_user_balance(db, bob.id)

    payment = Payment(user_id=bob.id, amount=Decimal("5.00"), status=PaymentStatus.PENDING)
    db.add(payment)
    db.flush()

    balance_after = calculate_user_balance(db, bob.id)
    assert balance_after == balance_before  # unchanged -- still pending


def test_rejected_payment_does_not_reduce_balance(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")

    create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("2"),
        participant_user_ids=[creator.id, bob.id],
        created_by=creator.id,
        commit=False,
    )
    db.flush()

    balance_before = calculate_user_balance(db, bob.id)

    payment = Payment(user_id=bob.id, amount=Decimal("5.00"), status=PaymentStatus.REJECTED)
    db.add(payment)
    db.flush()

    assert calculate_user_balance(db, bob.id) == balance_before


def test_confirmed_partial_payment_reduces_balance_correctly(db):
    """
    Spec example:
      User owes RM20. They submit RM5 (PENDING). After admin confirmation:
      confirmed payments = RM5, remaining balance = RM15.
    """
    creator = make_user(db, "Admin", role=UserRole.ADMIN)
    bob = make_user(db, "Bob")

    # 20.00 owed to a single participant: 1 packet x RM20/packet, 1 person.
    create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("1"),
        participant_user_ids=[bob.id],
        created_by=creator.id,
        price_per_packet=Decimal("20.00"),
        commit=False,
    )
    db.flush()

    assert calculate_user_balance(db, bob.id) == Decimal("20.00")

    payment = Payment(user_id=bob.id, amount=Decimal("5.00"), status=PaymentStatus.PENDING)
    db.add(payment)
    db.flush()

    # Still pending -> balance unchanged.
    assert calculate_user_balance(db, bob.id) == Decimal("20.00")

    # Admin confirms.
    payment.status = PaymentStatus.CONFIRMED
    payment.confirmed_at = datetime.now(timezone.utc)
    payment.confirmed_by = creator.id
    db.flush()

    assert calculate_user_balance(db, bob.id) == Decimal("15.00")


def test_multiple_sessions_accumulate_balance(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")

    create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("1"),
        participant_user_ids=[creator.id, bob.id],
        created_by=creator.id,
        commit=False,
    )
    create_drink_session(
        db,
        session_date=date(2026, 1, 8),
        packets_used=Decimal("1.5"),
        participant_user_ids=[creator.id, bob.id],
        created_by=creator.id,
        commit=False,
    )
    db.flush()

    # Session 1: 25.00 / 2 = 12.50 each. Session 2: 37.50 / 2 = 18.75 each.
    expected = Decimal("12.50") + Decimal("18.75")
    assert calculate_user_balance(db, bob.id) == expected


def test_multiple_confirmed_payments_sum_correctly(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")

    create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("2"),
        participant_user_ids=[creator.id, bob.id],
        created_by=creator.id,
        price_per_packet=Decimal("25.00"),
        commit=False,
    )
    db.flush()
    owed = calculate_user_balance(db, bob.id)  # 25.00

    p1 = Payment(user_id=bob.id, amount=Decimal("10.00"), status=PaymentStatus.CONFIRMED)
    p2 = Payment(user_id=bob.id, amount=Decimal("5.00"), status=PaymentStatus.CONFIRMED)
    p3 = Payment(user_id=bob.id, amount=Decimal("100.00"), status=PaymentStatus.PENDING)
    db.add_all([p1, p2, p3])
    db.flush()

    assert calculate_user_balance(db, bob.id) == owed - Decimal("15.00")


def test_balance_is_scoped_per_user(db):
    creator = make_user(db, "Alice")
    bob = make_user(db, "Bob")
    carol = make_user(db, "Carol")

    create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("1"),
        participant_user_ids=[bob.id, carol.id],
        created_by=creator.id,
        commit=False,
    )
    db.flush()

    payment = Payment(user_id=bob.id, amount=Decimal("12.50"), status=PaymentStatus.CONFIRMED)
    db.add(payment)
    db.flush()

    assert calculate_user_balance(db, bob.id) == Decimal("0.00")
    # Carol's balance must be unaffected by Bob's payment.
    assert calculate_user_balance(db, carol.id) == Decimal("12.50")
