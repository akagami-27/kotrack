
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.drink_session import DrinkSession
from app.models.enums import PaymentStatus, UserRole
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.session_participant import SessionParticipant
from app.models.user import User
from app.services.admin_service import get_session_financial_breakdown
from app.services.session_service import create_drink_session

import app.models  # noqa: F401


@pytest.fixture
def db():
    """Create an isolated in-memory SQLite database."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        future=True,
        poolclass=StaticPool,
    )

    Base.metadata.create_all(engine)

    with Session(engine) as session:
        yield session

    Base.metadata.drop_all(engine)
    engine.dispose()


def add_user(db: Session, name: str, role: UserRole) -> User:
    user = User(
        name=name,
        password_hash="not-a-real-password-hash",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def add_session(
    db: Session,
    creator: User,
    handler: User | None,
    participant: User,
) -> DrinkSession:
    return create_drink_session(
        db,
        session_date=date(2026, 10, 26),
        packets_used=Decimal("1"),
        participant_user_ids=[participant.id],
        created_by=creator.id,
        handler_id=handler.id if handler else None,
    )


def add_confirmed_payment(
    db: Session,
    user: User,
    amount: Decimal,
) -> Payment:
    payment = Payment(
        user_id=user.id,
        amount=amount,
        status=PaymentStatus.CONFIRMED,
    )
    db.add(payment)
    db.flush()
    return payment


def add_allocation(
    db: Session,
    payment: Payment,
    participant: SessionParticipant,
    amount: Decimal,
) -> PaymentAllocation:
    allocation = PaymentAllocation(
        payment_id=payment.id,
        session_participant_id=participant.id,
        amount=amount,
        allocation_type="MANUAL",
    )
    db.add(allocation)
    db.flush()
    return allocation


def get_participant(
    db: Session,
    session: DrinkSession,
    user: User,
) -> SessionParticipant:
    return (
        db.query(SessionParticipant)
        .filter(
            SessionParticipant.session_id == session.id,
            SessionParticipant.user_id == user.id,
        )
        .one()
    )


def test_super_admin_own_session_financial_breakdown(db: Session):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    member = add_user(db, "Member", UserRole.USER)

    session = add_session(
        db,
        creator=root,
        handler=root,
        participant=member,
    )

    participant = get_participant(db, session, member)
    owed = Decimal(str(participant.amount_owed))
    allocated = min(Decimal("5.00"), owed)

    payment = add_confirmed_payment(
        db,
        member,
        allocated,
    )
    add_allocation(db, payment, participant, allocated)

    result = get_session_financial_breakdown(db, root.id)

    mine = result["my_assigned_sessions"]

    assert mine["total_sessions"] == 1
    assert mine["total_session_value"] == Decimal(str(session.total_cost))
    assert mine["total_collected"] == allocated
    assert mine["total_outstanding"] == owed - allocated


def test_multiple_admins_have_separate_financial_breakdowns(db: Session):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Admin A", UserRole.ADMIN)
    admin_b = add_user(db, "Admin B", UserRole.ADMIN)

    member_a = add_user(db, "Member A", UserRole.USER)
    member_b = add_user(db, "Member B", UserRole.USER)

    session_a = add_session(
        db,
        creator=root,
        handler=admin_a,
        participant=member_a,
    )

    session_b = add_session(
        db,
        creator=root,
        handler=admin_b,
        participant=member_b,
    )

    participant_a = get_participant(db, session_a, member_a)
    participant_b = get_participant(db, session_b, member_b)

    owed_a = Decimal(str(participant_a.amount_owed))
    owed_b = Decimal(str(participant_b.amount_owed))

    collected_a = min(Decimal("5.00"), owed_a)
    collected_b = min(Decimal("10.00"), owed_b)

    payment_a = add_confirmed_payment(
        db,
        member_a,
        collected_a,
    )
    payment_b = add_confirmed_payment(
        db,
        member_b,
        collected_b,
    )

    add_allocation(db, payment_a, participant_a, collected_a)
    add_allocation(db, payment_b, participant_b, collected_b)

    result = get_session_financial_breakdown(db, root.id)

    admins = {
        item["handler_id"]: item
        for item in result["other_admins"]
    }

    assert admins[admin_a.id]["total_collected"] == collected_a
    assert admins[admin_a.id]["total_outstanding"] == owed_a - collected_a

    assert admins[admin_b.id]["total_collected"] == collected_b
    assert admins[admin_b.id]["total_outstanding"] == owed_b - collected_b

    assert admins[admin_a.id]["handler_name"] == "Admin A"
    assert admins[admin_b.id]["handler_name"] == "Admin B"


def test_unallocated_confirmed_payment_is_not_counted_as_collected(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Admin A", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)

    session = add_session(
        db,
        creator=root,
        handler=admin,
        participant=member,
    )

    participant = get_participant(db, session, member)
    owed = Decimal(str(participant.amount_owed))

    # This payment is confirmed but has no allocation.
    add_confirmed_payment(
        db,
        member,
        Decimal("20.00"),
    )

    result = get_session_financial_breakdown(db, root.id)

    admin_result = next(
        item
        for item in result["other_admins"]
        if item["handler_id"] == admin.id
    )

    assert admin_result["total_collected"] == Decimal("0.00")
    assert admin_result["total_outstanding"] == owed


def test_system_wide_and_unassigned_have_no_financial_attribution(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Admin A", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)

    add_session(
        db,
        creator=root,
        handler=None,
        participant=member,
    )

    result = get_session_financial_breakdown(db, root.id)

    unassigned = result["unassigned_sessions"]
    system_wide = result["system_wide"]
    combined_admins = result["other_admins_sessions"]

    assert unassigned["total_sessions"] == 1

    assert "total_collected" not in unassigned
    assert "total_outstanding" not in unassigned

    assert "total_collected" not in system_wide
    assert "total_outstanding" not in system_wide

    assert "total_collected" not in combined_admins
    assert "total_outstanding" not in combined_admins


def test_pending_payment_allocation_is_not_counted_as_collected(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Admin A", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)

    session = add_session(
        db,
        creator=root,
        handler=admin,
        participant=member,
    )

    participant = get_participant(db, session, member)
    owed = Decimal(str(participant.amount_owed))

    payment = Payment(
        user_id=member.id,
        amount=Decimal("5.00"),
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    db.flush()

    add_allocation(
        db,
        payment,
        participant,
        Decimal("5.00"),
    )

    result = get_session_financial_breakdown(db, root.id)

    admin_result = next(
        item
        for item in result["other_admins"]
        if item["handler_id"] == admin.id
    )

    assert admin_result["total_collected"] == Decimal("0.00")
    assert admin_result["total_outstanding"] == owed
