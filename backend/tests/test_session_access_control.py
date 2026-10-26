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
from app.models.user import User
from app.services.session_request_service import create_session_request
from app.services.session_service import create_drink_session
import app.models  # noqa: F401


@pytest.fixture
def db():
    """Use an isolated in-memory database; never use configured app DB."""
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


def as_user(client_db: Session, user: User) -> TestClient:
    fastapi_app.dependency_overrides[get_current_user] = lambda: user
    fastapi_app.dependency_overrides[get_db] = lambda: client_db
    return TestClient(fastapi_app)


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
    *,
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


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    fastapi_app.dependency_overrides.clear()
    yield
    fastapi_app.dependency_overrides.clear()


def test_admin_session_visibility_and_foreign_mutations_are_denied(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    siti = add_user(db, "Siti", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    member_a = add_user(db, "Member A", UserRole.USER)
    member_s = add_user(db, "Member S", UserRole.USER)
    own = add_session(db, creator=root, handler=ahmad, participant=member_a)
    foreign = add_session(db, creator=root, handler=siti, participant=member_s)
    db.commit()

    client = as_user(db, ahmad)
    try:
        listed = client.get("/api/sessions")
        assert listed.status_code == 200
        assert [row["id"] for row in listed.json()] == [own.id]
        assert client.get(f"/api/sessions/{own.id}").status_code == 200
        assert client.get(f"/api/sessions/{foreign.id}").status_code == 404
        assert client.get(
            "/api/sessions", params={"handler_id": siti.id, "user_id": siti.id}
        ).json() == listed.json()
        assert client.patch(
            f"/api/sessions/{foreign.id}",
            json={"handler_id": ahmad.id, "packets_used": "2"},
        ).status_code == 404
        assert client.delete(f"/api/sessions/{foreign.id}").status_code == 404
        db.expire_all()
        assert db.get(DrinkSession, foreign.id) is not None
        assert db.get(DrinkSession, foreign.id).handler_id == siti.id
    finally:
        client.close()


def test_super_admin_sees_sessions_assigned_to_both_admins(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    siti = add_user(db, "Siti", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    member_a = add_user(db, "Member A", UserRole.USER)
    member_s = add_user(db, "Member S", UserRole.USER)
    first = add_session(db, creator=root, handler=ahmad, participant=member_a)
    second = add_session(db, creator=root, handler=siti, participant=member_s)
    db.commit()

    client = as_user(db, root)
    try:
        listed = client.get("/api/sessions")
        assert listed.status_code == 200
        assert {row["id"] for row in listed.json()} == {first.id, second.id}
        assert client.get(f"/api/sessions/{second.id}").status_code == 200
    finally:
        client.close()


def test_admin_created_session_is_assigned_and_only_handler_can_reopen(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    siti = add_user(db, "Siti", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    db.commit()

    client = as_user(db, ahmad)
    try:
        created = client.post(
            "/api/sessions",
            json={
                "session_date": "2026-10-26",
                "packets_used": "1",
                "participant_user_ids": [member.id],
                "handler_id": siti.id,
            },
        )
        assert created.status_code == 201
        session_id = created.json()["id"]
        db.expire_all()
        assert db.get(DrinkSession, session_id).handler_id == siti.id
    finally:
        client.close()

    client = as_user(db, ahmad)
    try:
        assert client.get(f"/api/sessions/{session_id}").status_code == 404
    finally:
        client.close()

    client = as_user(db, siti)
    try:
        assert client.get(f"/api/sessions/{session_id}").status_code == 200
    finally:
        client.close()


def test_request_approval_and_regular_user_visibility_are_preserved(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    siti = add_user(db, "Siti", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    member = add_user(db, "Member", UserRole.USER)
    another = add_user(db, "Another", UserRole.USER)
    foreign = add_session(db, creator=root, handler=ahmad, participant=another)
    foreign_request = create_session_request(
        db,
        requested_by=another.id,
        session_date=date(2026, 10, 27),
        packets_used=Decimal("1"),
        participant_user_ids=[another.id],
        handler_id=siti.id,
    )
    db.commit()

    member_client = as_user(db, member)
    try:
        created = member_client.post(
            "/api/session-requests",
            json={
                "session_date": "2026-10-26",
                "packets_used": "1",
                "participant_user_ids": [member.id],
                "handler_id": ahmad.id,
            },
        )
        assert created.status_code == 201
        request_id = created.json()["id"]
        assert member_client.get("/api/session-requests/my").json()[0]["id"] == request_id
        assert member_client.get(f"/api/session-requests/{request_id}").status_code == 200
        assert member_client.get("/api/sessions").json() == []
        assert member_client.get(f"/api/sessions/{foreign.id}").status_code == 404
    finally:
        member_client.close()

    admin_client = as_user(db, ahmad)
    try:
        assert [row["id"] for row in admin_client.get("/api/session-requests").json()] == [request_id]
        assert admin_client.get(f"/api/session-requests/{foreign_request.id}").status_code == 404
        assert admin_client.post(f"/api/session-requests/{foreign_request.id}/approve").status_code == 404
        assert admin_client.post(f"/api/session-requests/{foreign_request.id}/reject").status_code == 404
        approved = admin_client.post(f"/api/session-requests/{request_id}/approve")
        assert approved.status_code == 200
        sessions = admin_client.get("/api/sessions").json()
        assert len(sessions) == 2
        assert all(row["handler_id"] == ahmad.id for row in sessions)
        approved_session_id = next(
            row["id"] for row in sessions if row["created_by"] == ahmad.id
        )
    finally:
        admin_client.close()

    member_client = as_user(db, member)
    try:
        member_sessions = member_client.get("/api/sessions").json()
        assert [row["id"] for row in member_sessions] == [approved_session_id]
        assert member_client.get(
            f"/api/sessions/{approved_session_id}"
        ).status_code == 200
    finally:
        member_client.close()


def test_admin_summary_and_payment_endpoints_exclude_other_handler_users(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    siti = add_user(db, "Siti", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    member_a = add_user(db, "Member A", UserRole.USER)
    member_s = add_user(db, "Member S", UserRole.USER)
    add_session(db, creator=root, handler=ahmad, participant=member_a)
    add_session(db, creator=root, handler=siti, participant=member_s)
    payment_a = Payment(
        user_id=member_a.id,
        amount=Decimal("5.00"),
        status=PaymentStatus.PENDING,
        receipt_data=b"own receipt",
        receipt_filename="own.pdf",
        receipt_content_type="application/pdf",
    )
    payment_s = Payment(
        user_id=member_s.id,
        amount=Decimal("7.00"),
        status=PaymentStatus.PENDING,
        receipt_data=b"foreign receipt",
        receipt_filename="foreign.pdf",
        receipt_content_type="application/pdf",
    )
    own_payment = Payment(
        user_id=ahmad.id,
        amount=Decimal("3.00"),
        status=PaymentStatus.PENDING,
        receipt_data=b"admin's own receipt",
        receipt_filename="self.pdf",
        receipt_content_type="application/pdf",
    )
    db.add_all([payment_a, payment_s, own_payment])
    db.commit()

    client = as_user(db, ahmad)
    try:
        analytics = client.get("/api/admin/analytics")
        assert analytics.status_code == 200
        assert {user["name"] for user in analytics.json()["users"]} == {"Member A"}

        payments = client.get("/api/payments")
        assert payments.status_code == 200
        assert [row["id"] for row in payments.json()] == [payment_a.id]
        assert client.get(f"/api/payments/{own_payment.id}/receipt").status_code == 200
        assert client.get(f"/api/payments/{payment_s.id}/receipt").status_code == 404
        assert client.patch(f"/api/payments/{payment_s.id}/confirm").status_code == 404
        assert client.patch(f"/api/payments/{payment_a.id}/confirm").status_code == 200
    finally:
        client.close()


def test_admin_payment_scope_excludes_users_shared_with_other_handlers(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    siti = add_user(db, "Siti", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    shared = add_user(db, "Shared", UserRole.USER)
    add_session(db, creator=root, handler=ahmad, participant=shared)
    add_session(db, creator=root, handler=siti, participant=shared)
    payment = Payment(
        user_id=shared.id,
        amount=Decimal("5.00"),
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    db.commit()

    client = as_user(db, ahmad)
    try:
        assert client.get("/api/payments").json() == []
        assert client.patch(f"/api/payments/{payment.id}/confirm").status_code == 404
    finally:
        client.close()


def test_deactivated_handler_is_cleared_and_session_becomes_unassigned(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    siti = add_user(db, "Siti", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    participant = add_user(db, "Participant", UserRole.USER)
    session = add_session(db, creator=root, handler=siti, participant=participant)
    db.commit()

    client = as_user(db, root)
    try:
        deactivated = client.patch(f"/api/users/admin/{siti.id}/deactivate")
        assert deactivated.status_code == 200
        db.refresh(session)
        assert session.handler_id is None
    finally:
        client.close()


def test_demoted_admin_creator_does_not_gain_regular_user_mutation_rights(db: Session):
    ahmad = add_user(db, "Ahmad", UserRole.ADMIN)
    root = add_user(db, "Root", UserRole.SUPER_ADMIN)
    participant = add_user(db, "Participant", UserRole.USER)
    session = add_session(db, creator=ahmad, handler=ahmad, participant=participant)
    db.commit()

    client = as_user(db, root)
    try:
        response = client.patch(
            f"/api/users/super-admin/users/{ahmad.id}/role",
            json={"role": "USER"},
        )
        assert response.status_code == 200
        db.refresh(session)
        assert session.handler_id is None
        assert session.creator_role_at_creation == UserRole.ADMIN.value
    finally:
        client.close()

    client = as_user(db, ahmad)
    try:
        assert client.patch(
            f"/api/sessions/{session.id}",
            json={"packets_used": "2"},
        ).status_code == 403
        assert client.delete(f"/api/sessions/{session.id}").status_code == 403
    finally:
        client.close()

    client = as_user(db, ahmad)
    try:
        assert client.get(f"/api/sessions/{session.id}").status_code == 404
    finally:
        client.close()

    client = as_user(db, root)
    try:
        assert client.get(f"/api/sessions/{session.id}").status_code == 200
    finally:
        client.close()
