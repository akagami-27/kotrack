
"""Tests for Admin-restricted FIFO payment allocation."""

from datetime import date
from decimal import Decimal

import pytest

from app.models.enums import PaymentStatus, UserRole
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.user import User
from app.services.fifo_allocation_service import allocate_payment_fifo
from app.services.session_service import create_drink_session


def make_user(db, name, role=UserRole.USER):
    user = User(
        name=name,
        password_hash="not-a-real-hash",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def make_session(db, *, creator, handler, participant, session_date, amount):
    return create_drink_session(
        db,
        session_date=session_date,
        packets_used=Decimal("1"),
        price_per_packet=Decimal(str(amount)),
        participant_user_ids=[participant.id],
        created_by=creator.id,
        handler_id=handler.id,
        commit=False,
    )


def make_payment(db, *, user, handler, amount, status=PaymentStatus.CONFIRMED):
    payment = Payment(
        user_id=user.id,
        handler_id=handler.id if handler else None,
        amount=Decimal(str(amount)),
        status=status,
        confirmed_by=handler.id if handler else None,
    )
    db.add(payment)
    db.flush()
    return payment


def allocations_for_payment(db, payment_id):
    return db.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment_id
    ).order_by(PaymentAllocation.id).all()


def test_fifo_allocates_to_oldest_session_first(db):
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    newer = make_session(
        db,
        creator=admin,
        handler=admin,
        participant=bob,
        session_date=date(2026, 1, 8),
        amount="20.00",
    )
    older = make_session(
        db,
        creator=admin,
        handler=admin,
        participant=bob,
        session_date=date(2026, 1, 1),
        amount="20.00",
    )

    payment = make_payment(
        db, user=bob, handler=admin, amount="25.00"
    )

    result = allocate_payment_fifo(
        db, payment_id=payment.id, actor=admin
    )

    rows = allocations_for_payment(db, payment.id)
    older_participant = older.participants[0]
    newer_participant = newer.participants[0]

    assert result.total_allocated == Decimal("25.00")
    assert result.remaining_payment == Decimal("0.00")
    assert result.allocations_created == 2

    assert rows[0].session_participant_id == older_participant.id
    assert rows[0].amount == Decimal("20.00")
    assert rows[1].session_participant_id == newer_participant.id
    assert rows[1].amount == Decimal("5.00")

    assert all(row.allocation_type == "FIFO" for row in rows)
    assert all(row.allocated_by == admin.id for row in rows)


def test_fifo_does_not_allocate_to_another_admin_sessions(db):
    admin_one = make_user(db, "Admin One", UserRole.ADMIN)
    admin_two = make_user(db, "Admin Two", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    own_session = make_session(
        db,
        creator=admin_one,
        handler=admin_one,
        participant=bob,
        session_date=date(2026, 1, 1),
        amount="10.00",
    )

    other_session = make_session(
        db,
        creator=admin_two,
        handler=admin_two,
        participant=bob,
        session_date=date(2026, 1, 2),
        amount="20.00",
    )

    payment = make_payment(
        db, user=bob, handler=admin_one, amount="30.00"
    )

    result = allocate_payment_fifo(
        db, payment_id=payment.id, actor=admin_one
    )

    rows = allocations_for_payment(db, payment.id)

    assert result.total_allocated == Decimal("10.00")
    assert result.remaining_payment == Decimal("20.00")
    assert len(rows) == 1
    assert rows[0].session_participant_id == own_session.participants[0].id
    assert rows[0].session_participant_id != other_session.participants[0].id


def test_fifo_only_allocates_to_payment_owner(db):
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")
    carol = make_user(db, "Carol")

    session = create_drink_session(
        db,
        session_date=date(2026, 1, 1),
        packets_used=Decimal("1"),
        price_per_packet=Decimal("20.00"),
        participant_user_ids=[bob.id, carol.id],
        created_by=admin.id,
        handler_id=admin.id,
        commit=False,
    )

    payment = make_payment(
        db, user=bob, handler=admin, amount="20.00"
    )

    result = allocate_payment_fifo(
        db, payment_id=payment.id, actor=admin
    )

    rows = allocations_for_payment(db, payment.id)

    assert result.total_allocated == Decimal("10.00")
    assert len(rows) == 1
    assert rows[0].session_participant_id == next(
        participant.id
        for participant in session.participants
        if participant.user_id == bob.id
    )


def test_fifo_respects_existing_manual_allocations(db):
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    session = make_session(
        db,
        creator=admin,
        handler=admin,
        participant=bob,
        session_date=date(2026, 1, 1),
        amount="20.00",
    )

    participant = session.participants[0]

    manual_payment = make_payment(
        db, user=bob, handler=admin, amount="5.00"
    )

    db.add(
        PaymentAllocation(
            payment_id=manual_payment.id,
            session_participant_id=participant.id,
            amount=Decimal("5.00"),
            allocation_type="MANUAL",
            allocated_by=admin.id,
        )
    )
    db.flush()

    fifo_payment = make_payment(
        db, user=bob, handler=admin, amount="20.00"
    )

    result = allocate_payment_fifo(
        db, payment_id=fifo_payment.id, actor=admin
    )

    rows = allocations_for_payment(db, fifo_payment.id)

    assert result.total_allocated == Decimal("15.00")
    assert result.remaining_payment == Decimal("5.00")
    assert len(rows) == 1
    assert rows[0].amount == Decimal("15.00")


def test_fifo_does_not_allocate_pending_payment(db):
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    make_session(
        db,
        creator=admin,
        handler=admin,
        participant=bob,
        session_date=date(2026, 1, 1),
        amount="20.00",
    )

    payment = make_payment(
        db,
        user=bob,
        handler=admin,
        amount="20.00",
        status=PaymentStatus.PENDING,
    )

    with pytest.raises(ValueError, match="CONFIRMED"):
        allocate_payment_fifo(
            db, payment_id=payment.id, actor=admin
        )

    assert allocations_for_payment(db, payment.id) == []


def test_fifo_requires_payment_handler(db):
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    payment = make_payment(
        db, user=bob, handler=None, amount="20.00"
    )

    with pytest.raises(ValueError, match="assigned to an Admin"):
        allocate_payment_fifo(
            db, payment_id=payment.id, actor=admin
        )

    assert allocations_for_payment(db, payment.id) == []


def test_admin_cannot_allocate_another_admin_payment(db):
    admin_one = make_user(db, "Admin One", UserRole.ADMIN)
    admin_two = make_user(db, "Admin Two", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    payment = make_payment(
        db, user=bob, handler=admin_one, amount="20.00"
    )

    with pytest.raises(PermissionError):
        allocate_payment_fifo(
            db, payment_id=payment.id, actor=admin_two
        )

    assert allocations_for_payment(db, payment.id) == []


def test_fifo_is_idempotent_for_fully_allocated_payment(db):
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    make_session(
        db,
        creator=admin,
        handler=admin,
        participant=bob,
        session_date=date(2026, 1, 1),
        amount="20.00",
    )

    payment = make_payment(
        db, user=bob, handler=admin, amount="20.00"
    )

    first_result = allocate_payment_fifo(
        db, payment_id=payment.id, actor=admin
    )
    second_result = allocate_payment_fifo(
        db, payment_id=payment.id, actor=admin
    )

    rows = allocations_for_payment(db, payment.id)

    assert first_result.total_allocated == Decimal("20.00")
    assert second_result.total_allocated == Decimal("0.00")
    assert second_result.allocations_created == 0
    assert len(rows) == 1


def test_fifo_leaves_excess_payment_unallocated(db):
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    make_session(
        db,
        creator=admin,
        handler=admin,
        participant=bob,
        session_date=date(2026, 1, 1),
        amount="10.00",
    )

    payment = make_payment(
        db, user=bob, handler=admin, amount="50.00"
    )

    result = allocate_payment_fifo(
        db, payment_id=payment.id, actor=admin
    )

    assert result.total_allocated == Decimal("10.00")
    assert result.remaining_payment == Decimal("40.00")
    assert result.allocations_created == 1


def test_super_admin_can_allocate_for_an_admin_handler(db):
    super_admin = make_user(db, "Super Admin", UserRole.SUPER_ADMIN)
    admin = make_user(db, "Admin", UserRole.ADMIN)
    bob = make_user(db, "Bob")

    make_session(
        db,
        creator=admin,
        handler=admin,
        participant=bob,
        session_date=date(2026, 1, 1),
        amount="20.00",
    )

    payment = make_payment(
        db, user=bob, handler=admin, amount="20.00"
    )

    result = allocate_payment_fifo(
        db, payment_id=payment.id, actor=super_admin
    )

    assert result.total_allocated == Decimal("20.00")
    rows = allocations_for_payment(db, payment.id)
    assert rows[0].allocated_by == super_admin.id
