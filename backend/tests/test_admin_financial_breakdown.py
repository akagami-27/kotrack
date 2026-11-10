
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
from app.models.inter_handler_settlement import InterHandlerSettlement
from app.models.session_participant import SessionParticipant
from app.models.user import User
from app.api.balance import get_my_balance
from app.services.admin_service import (
    get_admin_analytics,
    get_session_financial_breakdown,
)
from app.services.balance import calculate_user_balance, user_outstanding_by_handler
from app.services.session_service import create_drink_session
from app.services.payment_service import create_payment

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


def add_user(
    db: Session,
    name: str,
    role: UserRole,
    user_id: int | None = None,
) -> User:
    user = User(
        **({"id": user_id} if user_id is not None else {}),
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


def test_system_wide_includes_session_outstanding_but_unassigned_hides_it(
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
    assert system_wide["session_outstanding"] == Decimal("25.00")
    assert system_wide["inter_handler_receivable"] == Decimal("0.00")
    assert system_wide["total_outstanding"] == Decimal("25.00")

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


def test_user_outstanding_is_grouped_by_session_handler(db: Session):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Admin A", UserRole.ADMIN)
    admin_b = add_user(db, "Admin B", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)

    session_a = add_session(db, root, admin_a, member)
    session_b = add_session(db, root, admin_b, member)
    participant_a = get_participant(db, session_a, member)
    participant_b = get_participant(db, session_b, member)
    allocated = min(Decimal("5.00"), Decimal(str(participant_a.amount_owed)))

    payment = add_confirmed_payment(db, member, allocated)
    add_allocation(db, payment, participant_a, allocated)

    result = user_outstanding_by_handler(db, member.id)
    by_admin = {item["admin_id"]: item for item in result["admins"]}

    assert by_admin[admin_a.id]["outstanding"] == (
        Decimal(str(participant_a.amount_owed)) - allocated
    )
    assert by_admin[admin_b.id]["outstanding"] == Decimal(
        str(participant_b.amount_owed)
    )
    assert result["total_outstanding"] == sum(
        (item["outstanding"] for item in result["admins"]), Decimal("0.00")
    )
    assert calculate_user_balance(db, member.id) == result["total_outstanding"]


def test_other_users_payment_allocations_do_not_reduce_my_outstanding(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Admin", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    other_member = add_user(db, "Other Member", UserRole.USER)

    session = add_session(db, root, admin, member)
    participant = get_participant(db, session, member)
    other_participant = SessionParticipant(
        session_id=session.id,
        user_id=other_member.id,
        amount_owed=Decimal("5.00"),
    )
    db.add(other_participant)
    db.flush()

    payment = add_confirmed_payment(db, other_member, Decimal("5.00"))
    add_allocation(db, payment, other_participant, Decimal("5.00"))

    result = user_outstanding_by_handler(db, member.id)

    total_outstanding_by_admin = result["total_outstanding"]
    current_balance = calculate_user_balance(db, member.id)
    assert current_balance == total_outstanding_by_admin
    assert total_outstanding_by_admin == Decimal(str(participant.amount_owed))
    assert calculate_user_balance(db, other_member.id) == Decimal("0.00")
    assert result["admins"] == [{
        "admin_id": admin.id,
        "admin_name": admin.name,
        "outstanding": Decimal(str(participant.amount_owed)),
    }]


@pytest.mark.parametrize(
    "status",
    [PaymentStatus.PENDING, PaymentStatus.REJECTED],
)
def test_unconfirmed_allocations_do_not_reduce_user_outstanding(
    db: Session,
    status: PaymentStatus,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Admin", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    session = add_session(db, root, admin, member)
    participant = get_participant(db, session, member)

    payment = Payment(
        user_id=member.id,
        amount=Decimal("5.00"),
        status=status,
    )
    db.add(payment)
    db.flush()
    add_allocation(db, payment, participant, Decimal("5.00"))

    result = user_outstanding_by_handler(db, member.id)

    assert result["total_outstanding"] == Decimal(
        str(participant.amount_owed)
    )


def test_fully_paid_handler_is_omitted_from_outstanding_breakdown(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Admin", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    session = add_session(db, root, admin, member)
    participant = get_participant(db, session, member)
    owed = Decimal(str(participant.amount_owed))

    payment = add_confirmed_payment(db, member, owed)
    add_allocation(db, payment, participant, owed)

    result = user_outstanding_by_handler(db, member.id)

    assert result == {
        "total_outstanding": Decimal("0.00"),
        "admins": [{
            "admin_id": admin.id,
            "admin_name": admin.name,
            "outstanding": Decimal("0.00"),
        }],
    }
    assert calculate_user_balance(db, member.id) == result["total_outstanding"]


def test_current_balance_matches_admin_breakdown_for_100_and_150(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Akagami", UserRole.ADMIN)
    admin_b = add_user(db, "Symi", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)

    create_drink_session(
        db,
        session_date=date(2026, 10, 26),
        packets_used=Decimal("4"),
        participant_user_ids=[member.id],
        created_by=root.id,
        handler_id=admin_a.id,
    )
    db.flush()
    one_admin_result = user_outstanding_by_handler(db, member.id)
    assert one_admin_result["total_outstanding"] == Decimal("100.00")
    current_balance = calculate_user_balance(db, member.id)
    assert current_balance == one_admin_result["total_outstanding"]
    assert current_balance == Decimal("100.00")

    create_drink_session(
        db,
        session_date=date(2026, 10, 27),
        packets_used=Decimal("2"),
        participant_user_ids=[member.id],
        created_by=root.id,
        handler_id=admin_b.id,
    )
    db.flush()

    result = user_outstanding_by_handler(db, member.id)
    by_admin = {item["admin_id"]: item for item in result["admins"]}
    assert by_admin[admin_a.id]["outstanding"] == Decimal("100.00")
    assert by_admin[admin_b.id]["outstanding"] == Decimal("50.00")
    assert result["total_outstanding"] == Decimal("150.00")
    assert calculate_user_balance(db, member.id) == Decimal("150.00")
    assert result["total_outstanding"] == sum(
        (item["outstanding"] for item in result["admins"]), Decimal("0.00")
    )


def test_multiple_confirmed_allocations_are_counted_once_per_row(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Admin", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    session = add_session(db, root, admin, member)
    participant = get_participant(db, session, member)
    owed = Decimal(str(participant.amount_owed))
    first = Decimal("5.00")
    second = min(Decimal("3.00"), owed - first)

    payment_a = add_confirmed_payment(db, member, first)
    payment_b = add_confirmed_payment(db, member, second)
    add_allocation(db, payment_a, participant, first)
    add_allocation(db, payment_b, participant, second)

    result = user_outstanding_by_handler(db, member.id)

    assert result["total_outstanding"] == owed - first - second
    assert calculate_user_balance(db, member.id) == result["total_outstanding"]


def test_pending_inter_handler_settlement_is_receivable_once_by_payee(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN, user_id=1)
    payer = add_user(db, "Akagami", UserRole.ADMIN, user_id=2)
    payee = add_user(db, "symi", UserRole.ADMIN, user_id=9)
    payer_member = add_user(db, "Payer Member", UserRole.USER, user_id=10)
    payee_member = add_user(db, "Payee Member", UserRole.USER, user_id=11)

    add_session(db, root, payer, payer_member)
    add_session(db, root, payee, payee_member)
    db.add(InterHandlerSettlement(
        payer_handler_id=payer.id,
        payee_handler_id=payee.id,
        amount=Decimal("8.58"),
        status="PENDING",
    ))
    db.flush()

    result = get_session_financial_breakdown(db, root.id)
    buckets = {
        bucket["handler_id"]: bucket
        for bucket in result["other_admins"]
    }

    assert buckets[payer.id]["session_outstanding"] == Decimal("25.00")
    assert buckets[payer.id]["inter_handler_receivable"] == Decimal("0.00")
    assert buckets[payer.id]["total_outstanding"] == Decimal("25.00")
    assert buckets[payee.id]["session_outstanding"] == Decimal("25.00")
    assert buckets[payee.id]["inter_handler_receivable"] == Decimal("8.58")
    assert buckets[payee.id]["total_outstanding"] == Decimal("33.58")

    system = result["system_wide"]
    assert system["session_outstanding"] == Decimal("50.00")
    assert system["inter_handler_receivable"] == Decimal("8.58")
    assert system["total_outstanding"] == Decimal("58.58")
    assert (
        system["total_outstanding"] - system["session_outstanding"]
        == Decimal("8.58")
    )
    super_admin_analytics = get_admin_analytics(db, current_user=root)
    assert super_admin_analytics["summary"]["total_outstanding"] == (
        system["total_outstanding"]
    )


def test_paid_settlements_are_excluded_and_pending_settlements_sum(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    payee = add_user(db, "symi", UserRole.ADMIN)
    payer_a = add_user(db, "Akagami", UserRole.ADMIN)
    payer_b = add_user(db, "Other Admin", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    add_session(db, root, payee, member)

    db.add_all([
        InterHandlerSettlement(
            payer_handler_id=payer_a.id,
            payee_handler_id=payee.id,
            amount=Decimal("8.58"),
            status="PENDING",
        ),
        InterHandlerSettlement(
            payer_handler_id=payer_b.id,
            payee_handler_id=payee.id,
            amount=Decimal("1.42"),
            status="PENDING",
        ),
        InterHandlerSettlement(
            payer_handler_id=payer_a.id,
            payee_handler_id=payee.id,
            amount=Decimal("4.00"),
            status="PAID",
        ),
    ])
    db.flush()

    result = get_session_financial_breakdown(db, root.id)
    payee_bucket = next(
        bucket for bucket in result["other_admins"]
        if bucket["handler_id"] == payee.id
    )

    assert payee_bucket["inter_handler_receivable"] == Decimal("10.00")
    assert result["system_wide"]["inter_handler_receivable"] == Decimal("10.00")


def test_regular_admin_only_receives_own_settlement_financial_breakdown(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    payer = add_user(db, "Akagami", UserRole.ADMIN)
    payee = add_user(db, "symi", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    add_session(db, root, payer, member)
    db.add(InterHandlerSettlement(
        payer_handler_id=payer.id,
        payee_handler_id=payee.id,
        amount=Decimal("8.58"),
        status="PENDING",
    ))
    db.flush()

    response = get_admin_analytics(db, current_user=payer)
    breakdown = response["financial_breakdown"]

    assert set(breakdown) == {"my_assigned_sessions"}
    assert breakdown["my_assigned_sessions"]["inter_handler_receivable"] == (
        Decimal("0.00")
    )
    assert breakdown["my_assigned_sessions"]["session_outstanding"] == (
        Decimal("25.00")
    )
    assert response["summary"]["total_outstanding"] == Decimal("25.00")


def test_inter_handler_settlement_does_not_change_personal_session_outstanding(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    payer = add_user(db, "Akagami", UserRole.ADMIN)
    payee = add_user(db, "symi", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    session = add_session(db, root, payee, member)
    participant = get_participant(db, session, member)
    owed = Decimal(str(participant.amount_owed))
    before = user_outstanding_by_handler(db, member.id)

    db.add(InterHandlerSettlement(
        payer_handler_id=payer.id,
        payee_handler_id=payee.id,
        amount=Decimal("8.58"),
        status="PENDING",
    ))
    db.flush()
    after = user_outstanding_by_handler(db, member.id)

    assert before == after
    assert calculate_user_balance(db, member.id) == owed


def test_balance_response_reuses_dashboard_outstanding_breakdown(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Akagami", UserRole.ADMIN)
    admin_b = add_user(db, "Symi", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    add_session(db, root, admin_a, member)
    add_session(db, root, admin_b, member)

    response = get_my_balance(current_user=member, db=db)
    outstanding_total = sum(
        (row.outstanding for row in response.outstanding_by_admin),
        Decimal("0.00"),
    )

    assert response.balance == outstanding_total
    assert response.balance == calculate_user_balance(db, member.id)


def test_payment_must_target_an_admin_with_outstanding_sessions(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    owed_admin = add_user(db, "Akagami", UserRole.ADMIN)
    unrelated_admin = add_user(db, "Symi", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    add_session(db, root, owed_admin, member)

    payment = create_payment(
        db,
        user_id=member.id,
        handler_id=owed_admin.id,
        amount=Decimal("10.00"),
    )

    assert payment.handler_id == owed_admin.id
    with pytest.raises(
        ValueError,
        match="Selected Admin has no outstanding assigned-session balance",
    ):
        create_payment(
            db,
            user_id=member.id,
            handler_id=unrelated_admin.id,
            amount=Decimal("1.00"),
        )


def test_payment_cannot_exceed_selected_admin_outstanding_or_currency_precision(
    db: Session,
):
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin = add_user(db, "Akagami", UserRole.ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    session = add_session(db, root, admin, member)
    participant = get_participant(db, session, member)
    owed = Decimal(str(participant.amount_owed))

    with pytest.raises(ValueError, match="selected Admin's outstanding"):
        create_payment(
            db,
            user_id=member.id,
            handler_id=admin.id,
            amount=owed + Decimal("0.01"),
        )

    with pytest.raises(ValueError, match="at most 2 decimal places"):
        create_payment(
            db,
            user_id=member.id,
            handler_id=admin.id,
            amount=Decimal("1.001"),
        )
