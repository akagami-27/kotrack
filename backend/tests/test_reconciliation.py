"""
Tests for Step 5: Historical Payment Reconciliation.

Uses SQLite in-memory database (same pattern as test_session_access_control.py).

Concurrency/row-locking behaviour (SELECT … FOR UPDATE) is NOT tested here
because SQLite does not support FOR UPDATE. Those scenarios require a live
PostgreSQL database. All other business logic is tested below.

Coverage:
  5a  Eligible-payments listing
  5b  Payment detail with remaining amount
  5c  Reconciliation creation — happy paths
  5d  Validation — payment not found / not CONFIRMED
  5e  Validation — handler mismatches
  5f  Validation — participant ownership
  5g  Validation — amount exceeds participant debt
  5h  Validation — amount exceeds payment remaining
  5i  Validation — duplicate participant IDs
  5j  Validation — normal Admin cannot use another handler's ID
  5k  Validation — user (non-admin) is denied
  5l  Multi-batch reconciliation (partial then remainder)
  5m  Reconciliation history listing
  5n  Reconciliation detail retrieval
  5o  Super Admin can reconcile any payment
  5p  Handler assignment persists across batches
  5q  Normal Admin cannot view other handler's payment detail
  5r  balance.py functions are unchanged by reconciliation
"""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
from app.models.drink_session import DrinkSession
from app.models.enums import PaymentStatus, UserRole
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.payment_reconciliation import PaymentReconciliation
from app.models.session_participant import SessionParticipant
from app.models.user import User
from app.services.balance import calculate_user_balance, total_confirmed_payments
from app.services.reconciliation_service import (
    create_reconciliation,
    get_eligible_historical_payments,
    get_payment_remaining_amount,
    get_payment_with_remaining,
    get_participant_remaining_debt,
    get_reconciliation_detail,
    get_reconciliation_history,
)
from app.services.session_service import create_drink_session
import app.models  # noqa: F401 — register all models


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db():
    """Isolated SQLite in-memory database; never touches configured app DB."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    fastapi_app.dependency_overrides.clear()
    yield
    fastapi_app.dependency_overrides.clear()


def as_user(client_db: Session, user: User) -> TestClient:
    fastapi_app.dependency_overrides[get_current_user] = lambda: user
    fastapi_app.dependency_overrides[get_db] = lambda: client_db
    return TestClient(fastapi_app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def add_user(db: Session, name: str, role: UserRole) -> User:
    user = User(
        name=name,
        password_hash="not-a-real-hash",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def add_session(
    db: Session,
    *,
    creator: User,
    handler: User | None,
    participants: list[User],
) -> DrinkSession:
    return create_drink_session(
        db,
        session_date=date(2026, 10, 26),
        packets_used=Decimal("1"),
        participant_user_ids=[p.id for p in participants],
        created_by=creator.id,
        handler_id=handler.id if handler else None,
    )


def add_confirmed_payment(
    db: Session,
    *,
    user: User,
    amount: Decimal,
    handler_id: int | None = None,
) -> Payment:
    payment = Payment(
        user_id=user.id,
        amount=amount,
        status=PaymentStatus.CONFIRMED,
        handler_id=handler_id,
    )
    db.add(payment)
    db.flush()
    return payment


def add_pending_payment(db: Session, *, user: User, amount: Decimal) -> Payment:
    payment = Payment(
        user_id=user.id,
        amount=amount,
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    db.flush()
    return payment


def get_sp(db: Session, session: DrinkSession, user: User) -> SessionParticipant:
    """Return the SessionParticipant for user in session."""
    return (
        db.query(SessionParticipant)
        .filter(
            SessionParticipant.session_id == session.id,
            SessionParticipant.user_id == user.id,
        )
        .one()
    )


# ---------------------------------------------------------------------------
# 5a: Eligible payments listing
# ---------------------------------------------------------------------------


def test_5a_eligible_payments_admin_sees_own_handler_sessions_only(db: Session):
    """ADMIN only sees payments from users in their own sessions."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)
    user_b = add_user(db, "Member B", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    add_session(db, creator=super_admin, handler=admin_b, participants=[user_b])

    payment_a = add_confirmed_payment(db, user=user_a, amount=Decimal("20.00"))
    payment_b = add_confirmed_payment(db, user=user_b, amount=Decimal("15.00"))
    db.commit()

    visible = get_eligible_historical_payments(db, admin_a)
    ids = {p["id"] for p in visible}
    assert payment_a.id in ids
    assert payment_b.id not in ids


def test_5a_eligible_payments_super_admin_sees_all(db: Session):
    """SUPER_ADMIN sees all confirmed payments."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)
    user_b = add_user(db, "Member B", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    add_session(db, creator=super_admin, handler=admin_b, participants=[user_b])

    payment_a = add_confirmed_payment(db, user=user_a, amount=Decimal("20.00"))
    payment_b = add_confirmed_payment(db, user=user_b, amount=Decimal("15.00"))
    db.commit()

    visible = get_eligible_historical_payments(db, super_admin)
    ids = {p["id"] for p in visible}
    assert payment_a.id in ids
    assert payment_b.id in ids


def test_5a_pending_payments_excluded_from_eligible_list(db: Session):
    """PENDING payments must not appear in the eligible list."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    pending = add_pending_payment(db, user=user_a, amount=Decimal("10.00"))
    db.commit()

    visible = get_eligible_historical_payments(db, admin_a)
    ids = {p["id"] for p in visible}
    assert pending.id not in ids


def test_5a_eligible_payments_include_reconciliation_status(db: Session):
    """Returned dicts include remaining_amount and reconciliation_status."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("25.00"))
    db.commit()

    visible = get_eligible_historical_payments(db, admin_a)
    p = next(x for x in visible if x["id"] == payment.id)
    assert p["remaining_amount"] == Decimal("25.00")
    assert p["total_allocated"] == Decimal("0.00")
    assert p["reconciliation_status"] == "UNRECONCILED"


# ---------------------------------------------------------------------------
# 5b: Payment detail with remaining amount
# ---------------------------------------------------------------------------


def test_5b_payment_detail_unreconciled(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("30.00"))
    db.commit()

    detail = get_payment_with_remaining(db, payment.id, admin_a)
    assert detail["remaining_amount"] == Decimal("30.00")
    assert detail["total_allocated"] == Decimal("0.00")
    assert detail["reconciliation_status"] == "UNRECONCILED"


def test_5b_payment_detail_via_api_returns_200(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    payment = add_confirmed_payment(
        db, user=user_a, amount=Decimal("20.00"), handler_id=admin_a.id
    )
    db.commit()

    client = as_user(db, admin_a)
    try:
        resp = client.get(f"/api/reconciliation/payments/{payment.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == payment.id
        assert data["reconciliation_status"] == "UNRECONCILED"
        assert Decimal(str(data["remaining_amount"])) == Decimal("20.00")
    finally:
        client.close()


# ---------------------------------------------------------------------------
# 5c: Reconciliation creation — happy paths
# ---------------------------------------------------------------------------


def test_5c_create_reconciliation_full_payment(db: Session):
    """Allocate entire payment amount to one participant — FULLY_RECONCILED."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    recon = create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": amount_owed}],
    )
    db.commit()

    assert recon.id is not None
    assert recon.payment_id == payment.id
    assert recon.handler_id == admin_a.id
    assert recon.reconciled_by == admin_a.id
    assert len(recon.allocations) == 1
    assert recon.allocations[0].amount == amount_owed

    # payment.handler_id must be set.
    db.refresh(payment)
    assert payment.handler_id == admin_a.id

    # Remaining amount is now zero.
    remaining = get_payment_remaining_amount(db, payment.id)
    assert remaining == Decimal("0.00")


def test_5c_create_reconciliation_partial_payment(db: Session):
    """Allocate part of payment — PARTIAL status."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    partial = amount_owed / 2
    db.commit()

    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": partial}],
    )
    db.commit()

    detail = get_payment_with_remaining(db, payment.id, admin_a)
    assert detail["reconciliation_status"] == "PARTIAL"
    assert detail["remaining_amount"] == amount_owed - partial


def test_5c_create_reconciliation_with_notes(db: Session):
    """Notes are persisted on the reconciliation record."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    recon = create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": amount_owed}],
        notes="Settled in cash on-site.",
    )
    db.commit()

    assert recon.notes == "Settled in cash on-site."


def test_5c_create_reconciliation_via_api(db: Session):
    """POST /api/reconciliation/payments/{id}/reconcile returns 201."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = float(sp.amount_owed)
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal(str(amount_owed)))
    db.commit()

    client = as_user(db, admin_a)
    try:
        resp = client.post(
            f"/api/reconciliation/payments/{payment.id}/reconcile",
            json={
                "handler_id": admin_a.id,
                "allocations": [
                    {
                        "session_participant_id": sp.id,
                        "amount": str(amount_owed),
                    }
                ],
                "notes": "API test",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["payment_id"] == payment.id
        assert data["handler_id"] == admin_a.id
        assert len(data["allocations"]) == 1
    finally:
        client.close()


# ---------------------------------------------------------------------------
# 5d: Validation — payment not found / not CONFIRMED
# ---------------------------------------------------------------------------


def test_5d_payment_not_found_raises_value_error(db: Session):
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    db.commit()

    with pytest.raises(ValueError, match="not found"):
        create_reconciliation(
            db,
            payment_id=99999,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[{"session_participant_id": 1, "amount": Decimal("1.00")}],
        )


def test_5d_pending_payment_raises_value_error(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    payment = add_pending_payment(db, user=user_a, amount=Decimal("10.00"))
    db.commit()

    with pytest.raises(ValueError, match="PENDING"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[{"session_participant_id": 1, "amount": Decimal("1.00")}],
        )


def test_5d_pending_payment_via_api_returns_400(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    payment = add_pending_payment(db, user=user_a, amount=Decimal("10.00"))
    db.commit()

    client = as_user(db, admin_a)
    try:
        resp = client.post(
            f"/api/reconciliation/payments/{payment.id}/reconcile",
            json={
                "handler_id": admin_a.id,
                "allocations": [
                    {"session_participant_id": sp.id, "amount": "10.00"}
                ],
            },
        )
        assert resp.status_code == 400
    finally:
        client.close()


# ---------------------------------------------------------------------------
# 5e: Validation — handler mismatches
# ---------------------------------------------------------------------------


def test_5e_handler_id_mismatch_raises_value_error(db: Session):
    """Payment already assigned to admin_a; cannot reassign to admin_b."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    add_session(db, creator=super_admin, handler=admin_b, participants=[user_a])
    payment = add_confirmed_payment(
        db, user=user_a, amount=Decimal("50.00"), handler_id=admin_a.id
    )
    db.commit()

    with pytest.raises(ValueError, match="already assigned"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_b.id,
            actor=super_admin,
            allocations=[{"session_participant_id": 1, "amount": Decimal("1.00")}],
        )


def test_5e_non_admin_handler_id_raises_value_error(db: Session):
    """handler_id referencing a regular user is rejected."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)
    user_b = add_user(db, "Member B", UserRole.USER)

    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("20.00"))
    db.commit()

    with pytest.raises(ValueError, match="not an Admin"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=user_b.id,
            actor=super_admin,
            allocations=[{"session_participant_id": 1, "amount": Decimal("1.00")}],
        )


# ---------------------------------------------------------------------------
# 5f: Validation — participant ownership
# ---------------------------------------------------------------------------


def test_5f_participant_belonging_to_wrong_user_raises_value_error(db: Session):
    """Participant's user_id must match payment's user_id."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)
    user_b = add_user(db, "Member B", UserRole.USER)

    session_a = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    session_b = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_b]
    )
    sp_b = get_sp(db, session_b, user_b)
    # Payment belongs to user_a, but we try to allocate to user_b's sp.
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("30.00"))
    db.commit()

    with pytest.raises(ValueError, match="belongs to user"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[
                {"session_participant_id": sp_b.id, "amount": Decimal("10.00")}
            ],
        )


def test_5f_participant_in_wrong_handler_session_raises_value_error(db: Session):
    """Participant's session must be assigned to the specified handler."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    # user_a is in admin_b's session, but we try to reconcile under admin_a.
    session_b = add_session(
        db, creator=super_admin, handler=admin_b, participants=[user_a]
    )
    sp = get_sp(db, session_b, user_a)
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("30.00"))
    db.commit()

    with pytest.raises(ValueError, match="assigned to handler"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[
                {"session_participant_id": sp.id, "amount": Decimal("10.00")}
            ],
        )


# ---------------------------------------------------------------------------
# 5g: Validation — amount exceeds participant debt
# ---------------------------------------------------------------------------


def test_5g_allocation_exceeds_participant_debt_raises_value_error(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    over_amount = amount_owed + Decimal("1.00")
    payment = add_confirmed_payment(
        db, user=user_a, amount=over_amount + Decimal("10.00")
    )
    db.commit()

    with pytest.raises(ValueError, match="exceeds remaining debt"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[
                {"session_participant_id": sp.id, "amount": over_amount}
            ],
        )


# ---------------------------------------------------------------------------
# 5h: Validation — amount exceeds payment remaining
# ---------------------------------------------------------------------------


def test_5h_total_allocation_exceeds_payment_remaining_raises_value_error(
    db: Session,
):
    """Sum of all allocations must not exceed payment remaining amount."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))

    # Payment is only half the debt; trying to allocate full debt must fail.
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed / 2)
    db.commit()

    with pytest.raises(ValueError, match="exceeds payment remaining"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[
                {"session_participant_id": sp.id, "amount": amount_owed}
            ],
        )


# ---------------------------------------------------------------------------
# 5i: Validation — duplicate participant IDs
# ---------------------------------------------------------------------------


def test_5i_duplicate_participant_ids_in_request_raises_value_error(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed * 2)
    db.commit()

    with pytest.raises(ValueError, match="[Dd]uplicate"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[
                {"session_participant_id": sp.id, "amount": Decimal("1.00")},
                {"session_participant_id": sp.id, "amount": Decimal("1.00")},
            ],
        )


# ---------------------------------------------------------------------------
# 5j: Validation — normal Admin cannot use another handler's ID
# ---------------------------------------------------------------------------


def test_5j_admin_cannot_reconcile_as_different_handler(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    add_session(db, creator=super_admin, handler=admin_b, participants=[user_a])
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("30.00"))
    db.commit()

    with pytest.raises(PermissionError, match="only reconcile.*own"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_b.id,
            actor=admin_a,
            allocations=[{"session_participant_id": 1, "amount": Decimal("1.00")}],
        )


# ---------------------------------------------------------------------------
# 5k: Validation — regular user is denied
# ---------------------------------------------------------------------------


def test_5k_regular_user_cannot_reconcile_via_api(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("20.00"))
    db.commit()

    client = as_user(db, user_a)
    try:
        resp = client.post(
            f"/api/reconciliation/payments/{payment.id}/reconcile",
            json={
                "handler_id": admin_a.id,
                "allocations": [
                    {"session_participant_id": sp.id, "amount": "10.00"}
                ],
            },
        )
        assert resp.status_code == 403
    finally:
        client.close()


def test_5k_regular_user_cannot_list_eligible_payments_via_api(db: Session):
    user_a = add_user(db, "Member A", UserRole.USER)
    db.commit()

    client = as_user(db, user_a)
    try:
        resp = client.get("/api/reconciliation/eligible-payments")
        assert resp.status_code == 403
    finally:
        client.close()


# ---------------------------------------------------------------------------
# 5l: Multi-batch reconciliation
# ---------------------------------------------------------------------------


def test_5l_two_partial_batches_fully_reconcile_payment(db: Session):
    """Two consecutive reconciliation batches drain the full payment amount."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    half = (amount_owed / 2).quantize(Decimal("0.01"))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    # First batch.
    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": half}],
    )
    db.commit()

    remaining_after_first = get_payment_remaining_amount(db, payment.id)
    assert remaining_after_first == amount_owed - half

    # Second batch — remainder.
    second_amount = remaining_after_first
    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": second_amount}],
    )
    db.commit()

    remaining_after_second = get_payment_remaining_amount(db, payment.id)
    assert remaining_after_second == Decimal("0.00")

    detail = get_payment_with_remaining(db, payment.id, admin_a)
    assert detail["reconciliation_status"] == "FULLY_RECONCILED"


def test_5l_second_batch_exceeding_remaining_is_rejected(db: Session):
    """After first batch, trying to over-allocate in second batch is rejected."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    half = (amount_owed / 2).quantize(Decimal("0.01"))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": half}],
    )
    db.commit()

    with pytest.raises(ValueError, match="exceeds payment remaining|exceeds remaining debt"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_a.id,
            actor=admin_a,
            allocations=[
                {"session_participant_id": sp.id, "amount": amount_owed}
            ],
        )


# ---------------------------------------------------------------------------
# 5m: Reconciliation history
# ---------------------------------------------------------------------------


def test_5m_history_returns_chronological_records(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    half = (amount_owed / 2).quantize(Decimal("0.01"))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    r1 = create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": half}],
    )
    db.commit()

    remainder = get_payment_remaining_amount(db, payment.id)
    r2 = create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": remainder}],
    )
    db.commit()

    history = get_reconciliation_history(db, payment.id, admin_a)
    assert len(history) == 2
    assert history[0].id == r1.id
    assert history[1].id == r2.id


def test_5m_history_via_api(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    # Create one reconciliation.
    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": amount_owed}],
    )
    db.commit()

    client = as_user(db, admin_a)
    try:
        resp = client.get(f"/api/reconciliation/payments/{payment.id}/history")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["payment_id"] == payment.id
    finally:
        client.close()


def test_5m_other_admin_cannot_view_history(db: Session):
    """An Admin cannot view reconciliation history for another handler's payment."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    payment = add_confirmed_payment(
        db, user=user_a, amount=Decimal("20.00"), handler_id=admin_a.id
    )
    db.commit()

    client = as_user(db, admin_b)
    try:
        resp = client.get(f"/api/reconciliation/payments/{payment.id}/history")
        assert resp.status_code == 403
    finally:
        client.close()


# ---------------------------------------------------------------------------
# 5n: Reconciliation detail retrieval
# ---------------------------------------------------------------------------


def test_5n_get_reconciliation_detail(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    recon = create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": amount_owed}],
    )
    db.commit()

    retrieved = get_reconciliation_detail(db, recon.id, admin_a)
    assert retrieved.id == recon.id
    assert len(retrieved.allocations) == 1

    # via API
    client = as_user(db, admin_a)
    try:
        resp = client.get(f"/api/reconciliation/{recon.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == recon.id
    finally:
        client.close()


def test_5n_detail_404_for_missing_id(db: Session):
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    db.commit()

    client = as_user(db, admin_a)
    try:
        resp = client.get("/api/reconciliation/99999")
        assert resp.status_code == 404
    finally:
        client.close()


# ---------------------------------------------------------------------------
# 5o: Super Admin can reconcile any payment
# ---------------------------------------------------------------------------


def test_5o_super_admin_can_reconcile_payment_assigned_to_any_handler(
    db: Session,
):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    recon = create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=super_admin,  # Super Admin acts on behalf of admin_a's sessions.
        allocations=[{"session_participant_id": sp.id, "amount": amount_owed}],
    )
    db.commit()

    assert recon.reconciled_by == super_admin.id
    assert recon.handler_id == admin_a.id


def test_5o_super_admin_can_view_any_payment_detail(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    payment = add_confirmed_payment(
        db, user=user_a, amount=Decimal("20.00"), handler_id=admin_a.id
    )
    db.commit()

    # Super Admin (not the handler) can view the detail.
    detail = get_payment_with_remaining(db, payment.id, super_admin)
    assert detail["id"] == payment.id


# ---------------------------------------------------------------------------
# 5p: Handler assignment persists across batches
# ---------------------------------------------------------------------------


def test_5p_handler_assigned_on_first_batch_cannot_change(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    add_session(db, creator=super_admin, handler=admin_b, participants=[user_a])
    payment = add_confirmed_payment(db, user=user_a, amount=Decimal("50.00"))
    db.commit()

    # First batch sets handler to admin_a.
    sp_a = (
        db.query(SessionParticipant)
        .join(DrinkSession)
        .filter(
            DrinkSession.handler_id == admin_a.id,
            SessionParticipant.user_id == user_a.id,
        )
        .one()
    )
    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=super_admin,
        allocations=[{"session_participant_id": sp_a.id, "amount": Decimal("10.00")}],
    )
    db.commit()

    db.refresh(payment)
    assert payment.handler_id == admin_a.id

    # Second attempt with admin_b must fail.
    sp_b = (
        db.query(SessionParticipant)
        .join(DrinkSession)
        .filter(
            DrinkSession.handler_id == admin_b.id,
            SessionParticipant.user_id == user_a.id,
        )
        .one()
    )
    with pytest.raises(ValueError, match="already assigned"):
        create_reconciliation(
            db,
            payment_id=payment.id,
            handler_id=admin_b.id,
            actor=super_admin,
            allocations=[
                {"session_participant_id": sp_b.id, "amount": Decimal("5.00")}
            ],
        )


# ---------------------------------------------------------------------------
# 5q: Normal Admin cannot view another handler's payment detail
# ---------------------------------------------------------------------------


def test_5q_admin_cannot_view_other_handler_payment_detail(db: Session):
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    admin_b = add_user(db, "Siti", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    payment = add_confirmed_payment(
        db, user=user_a, amount=Decimal("20.00"), handler_id=admin_a.id
    )
    db.commit()

    with pytest.raises(PermissionError):
        get_payment_with_remaining(db, payment.id, admin_b)


def test_5q_admin_can_view_unassigned_payment_detail(db: Session):
    """An Admin can view a payment not yet assigned to any handler."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    add_session(db, creator=super_admin, handler=admin_a, participants=[user_a])
    payment = add_confirmed_payment(
        db, user=user_a, amount=Decimal("20.00")
    )  # handler_id=None
    db.commit()

    detail = get_payment_with_remaining(db, payment.id, admin_a)
    assert detail["id"] == payment.id


# ---------------------------------------------------------------------------
# 5r: balance.py functions are unchanged
# ---------------------------------------------------------------------------


def test_5r_overall_balance_unaffected_by_reconciliation(db: Session):
    """
    Reconciliation must not change the overall user balance.
    The overall balance only changes when a new CONFIRMED payment is added
    or when amount_owed changes — both of which are outside Step 5 scope.
    """
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    # Balance before reconciliation.
    balance_before = calculate_user_balance(db, user_a.id)
    total_paid_before = total_confirmed_payments(db, user_a.id)

    # Reconcile.
    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": amount_owed}],
    )
    db.commit()

    # Balance after reconciliation must be identical.
    balance_after = calculate_user_balance(db, user_a.id)
    total_paid_after = total_confirmed_payments(db, user_a.id)

    assert balance_before == balance_after
    assert total_paid_before == total_paid_after


def test_5r_participant_remaining_debt_reflects_allocations(db: Session):
    """get_participant_remaining_debt decreases as allocations are made."""
    super_admin = add_user(db, "Root", UserRole.SUPER_ADMIN)
    admin_a = add_user(db, "Ahmad", UserRole.ADMIN)
    user_a = add_user(db, "Member A", UserRole.USER)

    session = add_session(
        db, creator=super_admin, handler=admin_a, participants=[user_a]
    )
    sp = get_sp(db, session, user_a)
    amount_owed = Decimal(str(sp.amount_owed))
    half = (amount_owed / 2).quantize(Decimal("0.01"))
    payment = add_confirmed_payment(db, user=user_a, amount=amount_owed)
    db.commit()

    debt_before = get_participant_remaining_debt(db, sp.id)
    assert debt_before == amount_owed

    create_reconciliation(
        db,
        payment_id=payment.id,
        handler_id=admin_a.id,
        actor=admin_a,
        allocations=[{"session_participant_id": sp.id, "amount": half}],
    )
    db.commit()

    debt_after = get_participant_remaining_debt(db, sp.id)
    assert debt_after == amount_owed - half
