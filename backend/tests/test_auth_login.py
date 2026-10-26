from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
from app.models.enums import UserRole
from app.models.user import User
import app.models  # noqa: F401


@pytest.fixture
def db() -> Generator[Session, None, None]:
    """Run auth integration checks against a disposable in-memory schema."""
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


def add_user(
    db: Session,
    name: str,
    role: UserRole,
    *,
    active: bool = True,
) -> User:
    user = User(
        name=name,
        password_hash=hash_password("Correct-Horse-27"),
        role=role,
        is_active=active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.mark.parametrize(
    "role",
    [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
)
def test_login_issues_token_and_resolves_existing_role(
    db: Session,
    role: UserRole,
) -> None:
    user = add_user(db, f"existing-{role.value.lower()}", role)
    fastapi_app.dependency_overrides[get_db] = lambda: db

    with TestClient(fastapi_app) as client:
        login = client.post(
            "/api/auth/login",
            json={"name": user.name, "password": "Correct-Horse-27"},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]

        current_user = client.get(
            "/api/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert current_user.status_code == 200
    assert current_user.json()["id"] == user.id
    assert current_user.json()["role"] == role.value


@pytest.mark.parametrize(
    ("name", "password"),
    [
        ("missing-user", "Correct-Horse-27"),
        ("existing-user", "Incorrect-Horse-27"),
    ],
)
def test_unknown_user_and_wrong_password_return_401(
    db: Session,
    name: str,
    password: str,
) -> None:
    add_user(db, "existing-user", UserRole.USER)
    fastapi_app.dependency_overrides[get_db] = lambda: db

    with TestClient(fastapi_app) as client:
        response = client.post(
            "/api/auth/login",
            json={"name": name, "password": password},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect name or password"


def test_database_exception_response_does_not_expose_internal_details(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api import auth

    def broken_authentication(*args, **kwargs):
        raise SQLAlchemyError("internal-dsn-and-password-must-not-leak")

    monkeypatch.setattr(auth, "authenticate_user", broken_authentication)
    fastapi_app.dependency_overrides[get_db] = lambda: db

    with TestClient(fastapi_app) as client:
        response = client.post(
            "/api/auth/login",
            json={"name": "diagnostic-user", "password": "not-a-real-password"},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Authentication is temporarily unavailable"
    assert "internal-dsn" not in response.text
    assert "password-must-not-leak" not in response.text
    assert "Traceback" not in response.text


def test_inactive_user_cannot_log_in(db: Session) -> None:
    user = add_user(db, "inactive-user", UserRole.USER, active=False)
    fastapi_app.dependency_overrides[get_db] = lambda: db

    with TestClient(fastapi_app) as client:
        response = client.post(
            "/api/auth/login",
            json={"name": user.name, "password": "Correct-Horse-27"},
        )

    assert response.status_code == 401


def test_authentication_model_has_no_email_dependency() -> None:
    assert "email" not in User.__table__.columns


def test_postgres_login_succeeds_when_users_table_has_no_email(engine) -> None:
    """Reproduce the production schema shape using a temporary PG table."""
    from sqlalchemy.orm import Session

    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        session.execute(text(
            "CREATE TEMP TABLE users (id integer PRIMARY KEY, name varchar(255) NOT NULL, "
            "password_hash varchar(255) NOT NULL, role user_role NOT NULL, "
            "is_active boolean NOT NULL) ON COMMIT DROP"
        ))
        session.execute(text(
            "INSERT INTO users (id, name, password_hash, role, is_active) "
            "VALUES (1, 'legacy-schema-user', :password_hash, 'USER', true)"
        ), {"password_hash": hash_password("Correct-Horse-27")})
        session.flush()
        fastapi_app.dependency_overrides[get_db] = lambda: session
        with TestClient(fastapi_app) as client:
            response = client.post(
                "/api/auth/login",
                json={"name": "legacy-schema-user", "password": "Correct-Horse-27"},
            )
        assert response.status_code == 200
        assert response.json()["token_type"] == "bearer"
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()
