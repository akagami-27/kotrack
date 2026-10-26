from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, require_admin
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
import app.models  # noqa: F401
from app.models.drink_session import DrinkSession
from app.models.enums import UserRole
from app.models.session_request import SessionRequest
from app.models.user import User
from app.services.session_request_service import (
    approve_session_request,
    create_session_request,
)
from app.services.session_service import (
    create_drink_session,
    update_drink_session,
)
from app.services.user_management_service import (
    LastSuperAdminError,
    change_user_role,
)


@pytest.fixture
def db():
    """Each test owns a disposable in-memory SQLite database."""
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
    *,
    email: str | None = None,
    active: bool = True,
) -> User:
    user = User(
        name=name,
        email=email,
        password_hash="not-a-real-password-hash",
        role=role,
        is_active=active,
    )
    db.add(user)
    db.flush()
    return user


def test_admin_authorization_accepts_super_admin(db: Session) -> None:
    super_admin = add_user(db, "root", UserRole.SUPER_ADMIN)
    assert require_admin(current_user=super_admin) is super_admin


@pytest.mark.parametrize("role", [UserRole.USER, UserRole.ADMIN])
def test_non_super_admin_role_changes_are_forbidden(
    db: Session,
    role: UserRole,
) -> None:
    actor = add_user(db, "actor", role)
    target = add_user(db, "target", UserRole.USER)
    db.commit()

    fastapi_app.dependency_overrides[get_current_user] = lambda: actor
    fastapi_app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(fastapi_app) as client:
            response = client.patch(
                f"/api/users/super-admin/users/{target.id}/role",
                json={"role": "ADMIN"},
            )
        assert response.status_code == 403
        db.refresh(target)
        assert target.role == UserRole.USER
    finally:
        fastapi_app.dependency_overrides.clear()


def test_super_admin_can_promote_and_response_has_no_secrets(
    db: Session,
) -> None:
    actor = add_user(db, "root", UserRole.SUPER_ADMIN)
    target = add_user(
        db,
        "person",
        UserRole.USER,
        email="person@example.com",
    )
    db.commit()

    fastapi_app.dependency_overrides[get_current_user] = lambda: actor
    fastapi_app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(fastapi_app) as client:
            listed = client.get("/api/users/super-admin/users")
            changed = client.patch(
                f"/api/users/super-admin/users/{target.id}/role",
                json={"role": "ADMIN"},
            )
        assert listed.status_code == 200
        person = next(
            row for row in listed.json() if row["name"] == "person"
        )
        assert person["email"] == "person@example.com"
        assert "password_hash" not in person
        assert changed.status_code == 200
        assert changed.json()["role"] == "ADMIN"
        assert "password_hash" not in changed.json()
    finally:
        fastapi_app.dependency_overrides.clear()


def test_last_super_admin_cannot_be_demoted(db: Session) -> None:
    root = add_user(db, "root", UserRole.SUPER_ADMIN)
    db.commit()
    with pytest.raises(LastSuperAdminError):
        change_user_role(db, user_id=root.id, role=UserRole.USER)


def test_ordinary_user_endpoint_does_not_expose_email(db: Session) -> None:
    actor = add_user(db, "member", UserRole.USER)
    add_user(db, "private", UserRole.USER, email="private@example.com")
    db.commit()
    fastapi_app.dependency_overrides[get_current_user] = lambda: actor
    fastapi_app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(fastapi_app) as client:
            response = client.get("/api/users")
        assert response.status_code == 200
        assert all("email" not in item for item in response.json())
    finally:
        fastapi_app.dependency_overrides.clear()


def test_valid_handler_is_stored_on_session_and_legacy_null_remains_editable(
    db: Session,
) -> None:
    admin = add_user(db, "handler", UserRole.ADMIN)
    member = add_user(db, "member", UserRole.USER)
    creator = add_user(db, "creator", UserRole.SUPER_ADMIN)

    assigned = create_drink_session(
        db,
        session_date=date(2026, 10, 26),
        packets_used=Decimal("0.5"),
        participant_user_ids=[member.id],
        created_by=creator.id,
        handler_id=admin.id,
    )
    assert assigned.handler_id == admin.id
    assert assigned.handler_name == "handler"

    legacy = create_drink_session(
        db,
        session_date=date(2026, 10, 26),
        packets_used=Decimal("1"),
        participant_user_ids=[member.id],
        created_by=creator.id,
    )
    update_drink_session(
        db,
        drink_session=legacy,
        current_user=creator,
        packets_used=Decimal("2"),
    )
    assert legacy.handler_id is None
    assert legacy.handler_name is None


@pytest.mark.parametrize(
    ("role", "active"),
    [(UserRole.USER, True), (UserRole.ADMIN, False)],
)
def test_invalid_handler_assignments_are_rejected(
    db: Session,
    role: UserRole,
    active: bool,
) -> None:
    handler = add_user(db, "ineligible", role, active=active)
    member = add_user(db, "member", UserRole.USER)
    creator = add_user(db, "creator", UserRole.ADMIN)
    with pytest.raises(ValueError, match="session handler"):
        create_drink_session(
            db,
            session_date=date(2026, 10, 26),
            packets_used=Decimal("1"),
            participant_user_ids=[member.id],
            created_by=creator.id,
            handler_id=handler.id,
            commit=False,
        )


def test_handler_persists_from_request_to_approved_session(db: Session) -> None:
    member = add_user(db, "member", UserRole.USER)
    handler = add_user(db, "handler", UserRole.ADMIN)
    reviewer = add_user(db, "reviewer", UserRole.SUPER_ADMIN)
    request = create_session_request(
        db,
        requested_by=member.id,
        session_date=date(2026, 10, 26),
        packets_used=Decimal("1"),
        participant_user_ids=[member.id],
        handler_id=handler.id,
    )
    approved = approve_session_request(
        db,
        request=request,
        admin_user_id=reviewer.id,
    )
    session = db.scalar(
        select(DrinkSession).where(DrinkSession.created_by == reviewer.id)
    )
    assert approved.status == "APPROVED"
    assert session is not None
    assert session.handler_id == handler.id


def test_role_demotion_clears_ineligible_handler_references(db: Session) -> None:
    root = add_user(db, "root", UserRole.SUPER_ADMIN)
    handler = add_user(db, "handler", UserRole.ADMIN)
    member = add_user(db, "member", UserRole.USER)
    session = create_drink_session(
        db,
        session_date=date(2026, 10, 26),
        packets_used=Decimal("1"),
        participant_user_ids=[member.id],
        created_by=root.id,
        handler_id=handler.id,
    )
    request = create_session_request(
        db,
        requested_by=member.id,
        session_date=date(2026, 10, 27),
        packets_used=Decimal("1"),
        participant_user_ids=[member.id],
        handler_id=handler.id,
    )

    change_user_role(db, user_id=handler.id, role=UserRole.USER)

    assert session.handler_id is None
    db.refresh(request)
    assert request.handler_id is None
    assert handler.role == UserRole.USER
