from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
from app.models.enums import UserRole
from app.models.password_reset import PasswordResetRequest
from app.models.user import User
from app.services.password_reset_service import decide_password_reset
from app.services.password_reset_service import complete_password_reset
import app.models  # noqa: F401


@pytest.fixture
def db() -> Generator[Session, None, None]:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
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


def add_user(db: Session, name: str, role: UserRole) -> User:
    user = User(name=name, password_hash=hash_password("Initial-Password-42"), role=role, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def client_for(db: Session, current_user: User | None = None) -> TestClient:
    fastapi_app.dependency_overrides[get_db] = lambda: db
    if current_user is not None:
        fastapi_app.dependency_overrides[get_current_user] = lambda: current_user
    return TestClient(fastapi_app, base_url="https://testserver")


def submit(client: TestClient, username: str) -> None:
    response = client.post("/api/auth/password-reset/request", json={"name": username})
    assert response.status_code == 202
    assert response.json() == {"message": "If the account is eligible, the request has been recorded for review."}
    assert "httponly" in response.headers["set-cookie"].lower()


def test_approved_request_is_completed_once_by_original_browser(db: Session) -> None:
    member = add_user(db, "member", UserRole.USER)
    reviewer = add_user(db, "reviewer", UserRole.SUPER_ADMIN)
    with client_for(db) as user_client:
        submit(user_client, member.name)
        request = db.execute(select(PasswordResetRequest)).scalar_one()
        assert request.status == "PENDING" and request.reset_session_hash
        assert user_client.post("/api/auth/password-reset/complete", json={"new_password": "Changed-Password-73"}).status_code == 400
        with client_for(db, reviewer) as admin_client:
            approved = admin_client.post(f"/api/admin/password-reset-requests/{request.id}/approve")
        assert approved.status_code == 200
        assert approved.json()["status"] == "APPROVED"
        with client_for(db) as other_browser:
            assert other_browser.post(
                "/api/auth/password-reset/complete",
                json={"new_password": "Changed-Password-73"},
            ).status_code == 400
        assert user_client.get("/api/auth/password-reset/status").json()["status"] == "APPROVED"
        changed = user_client.post("/api/auth/password-reset/complete", json={"new_password": "Changed-Password-73"})
        assert changed.status_code == 200
        replay = user_client.post("/api/auth/password-reset/complete", json={"new_password": "Second-Password-73"})
    assert replay.status_code == 400
    db.refresh(member)
    db.refresh(request)
    assert verify_password("Changed-Password-73", member.password_hash)
    assert request.status == "COMPLETED" and request.completed_at is not None
    assert request.approved_by == reviewer.id and request.approved_at is not None
    assert request.reset_session_hash is None


def test_public_request_does_not_enumerate_accounts(db: Session) -> None:
    add_user(db, "known", UserRole.USER)
    with client_for(db) as client:
        known = client.post("/api/auth/password-reset/request", json={"name": "known"})
        unknown = client.post("/api/auth/password-reset/request", json={"name": "missing"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert db.query(PasswordResetRequest).count() == 1


def test_authenticated_self_request_uses_code_free_session(db: Session) -> None:
    member = add_user(db, "member", UserRole.USER)
    with client_for(db, member) as client:
        response = client.post("/api/users/me/password-reset-request")
    assert response.status_code == 202
    assert response.json()["request_id"] is not None
    row = db.get(PasswordResetRequest, response.json()["request_id"])
    assert row is not None and row.user_id == member.id
    assert row.reset_session_hash and row.status == "PENDING"


@pytest.mark.parametrize("role", [UserRole.ADMIN, UserRole.USER])
def test_only_super_admin_can_approve_or_reject(db: Session, role: UserRole) -> None:
    target = add_user(db, "target", UserRole.USER)
    actor = add_user(db, "actor", role)
    with client_for(db) as anonymous:
        submit(anonymous, target.name)
    request = db.execute(select(PasswordResetRequest)).scalar_one()
    with client_for(db, actor) as client:
        approve = client.post(f"/api/admin/password-reset-requests/{request.id}/approve")
        reject = client.post(f"/api/admin/password-reset-requests/{request.id}/reject")
    assert approve.status_code == reject.status_code == 403
    assert request.status == "PENDING"


def test_super_admin_cannot_decide_own_request(db: Session) -> None:
    reviewer = add_user(db, "reviewer", UserRole.SUPER_ADMIN)
    with client_for(db) as client:
        submit(client, reviewer.name)
    request = db.execute(select(PasswordResetRequest)).scalar_one()
    with client_for(db, reviewer) as client:
        assert client.post(f"/api/admin/password-reset-requests/{request.id}/approve").status_code == 403


def test_rejection_is_audited_and_cannot_be_completed(db: Session) -> None:
    member = add_user(db, "member", UserRole.USER)
    reviewer = add_user(db, "reviewer", UserRole.SUPER_ADMIN)
    original_hash = member.password_hash
    with client_for(db) as user_client:
        submit(user_client, member.name)
        request = db.execute(select(PasswordResetRequest)).scalar_one()
        with client_for(db, reviewer) as admin_client:
            response = admin_client.post(f"/api/admin/password-reset-requests/{request.id}/reject")
        assert response.status_code == 200
        assert user_client.post("/api/auth/password-reset/complete", json={"new_password": "Changed-Password-73"}).status_code == 400
    db.refresh(request)
    assert request.status == "REJECTED" and request.rejected_by == reviewer.id and request.rejected_at is not None
    assert member.password_hash == original_hash


def test_conflicting_second_decision_is_rejected(db: Session) -> None:
    member = add_user(db, "member", UserRole.USER)
    first = add_user(db, "first", UserRole.SUPER_ADMIN)
    second = add_user(db, "second", UserRole.SUPER_ADMIN)
    with client_for(db) as client:
        submit(client, member.name)
    request = db.execute(select(PasswordResetRequest)).scalar_one()
    decide_password_reset(db, request_id=request.id, admin=first, approve=True)
    db.commit()
    with pytest.raises(ValueError):
        decide_password_reset(db, request_id=request.id, admin=second, approve=False)


def test_concurrent_decisions_have_one_winner(engine) -> None:
    from sqlalchemy.orm import Session as DatabaseSession

    with DatabaseSession(engine) as session:
        target = User(name="race-target", password_hash=hash_password("Initial-Password-42"), role=UserRole.USER, is_active=True)
        first = User(name="race-first", password_hash=hash_password("Initial-Password-42"), role=UserRole.SUPER_ADMIN, is_active=True)
        second = User(name="race-second", password_hash=hash_password("Initial-Password-42"), role=UserRole.SUPER_ADMIN, is_active=True)
        session.add_all([target, first, second])
        session.flush()
        request = PasswordResetRequest(user_id=target.id, status="PENDING", reset_session_hash="a" * 64, session_expires_at=datetime.now(timezone.utc) + timedelta(hours=24))
        session.add(request)
        session.commit()
        request_id, first_id, second_id = request.id, first.id, second.id
    barrier = Barrier(2)

    def decision(admin_id: int, approve: bool) -> bool:
        with DatabaseSession(engine) as session:
            admin = session.get(User, admin_id)
            barrier.wait()
            try:
                decide_password_reset(session, request_id=request_id, admin=admin, approve=approve)
                session.commit()
                return True
            except ValueError:
                session.rollback()
                return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [pool.submit(decision, first_id, True), pool.submit(decision, second_id, False)]
        assert sum(result.result(timeout=15) for result in results) == 1


def test_concurrent_reset_completion_is_one_time(engine) -> None:
    from sqlalchemy.orm import Session as DatabaseSession

    raw_session = "one-use-browser-session-for-postgresql-test"
    with DatabaseSession(engine) as session:
        target = User(name="completion-race-target", password_hash=hash_password("Initial-Password-42"), role=UserRole.USER, is_active=True)
        reviewer = User(name="completion-race-reviewer", password_hash=hash_password("Initial-Password-42"), role=UserRole.SUPER_ADMIN, is_active=True)
        session.add_all([target, reviewer])
        session.flush()
        request = PasswordResetRequest(
            user_id=target.id,
            status="APPROVED",
            reset_session_hash=sha256(raw_session.encode()).hexdigest(),
            session_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            approved_at=datetime.now(timezone.utc),
            approved_by=reviewer.id,
        )
        session.add(request)
        session.commit()
        target_id, request_id = target.id, request.id
    barrier = Barrier(2)

    def complete(password: str) -> bool:
        with DatabaseSession(engine) as session:
            barrier.wait()
            try:
                complete_password_reset(session, raw_session=raw_session, new_password=password)
                session.commit()
                return True
            except ValueError:
                session.rollback()
                return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [
            pool.submit(complete, "First-Changed-Password-83"),
            pool.submit(complete, "Second-Changed-Password-84"),
        ]
        assert sum(result.result(timeout=15) for result in results) == 1
    with DatabaseSession(engine) as session:
        target = session.get(User, target_id)
        request = session.get(PasswordResetRequest, request_id)
        assert request.status == "COMPLETED" and request.completed_at is not None
        assert verify_password("First-Changed-Password-83", target.password_hash) or verify_password("Second-Changed-Password-84", target.password_hash)
