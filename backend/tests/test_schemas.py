import pytest
from pydantic import ValidationError

from app.schemas.user import LoginRequest, UserCreate


def test_user_create_accepts_valid_password():
    user = UserCreate(
        name="Akagami",
        password="Password123!",
    )

    assert user.name == "Akagami"
    assert user.password == "Password123!"


def test_user_create_rejects_short_password():
    with pytest.raises(ValidationError):
        UserCreate(
            name="Akagami",
            password="short",
        )


def test_login_request_accepts_valid_password():
    login = LoginRequest(
        name="Akagami",
        password="Password123!",
    )

    assert login.name == "Akagami"
    assert login.password == "Password123!"


def test_login_request_rejects_short_password():
    with pytest.raises(ValidationError):
        LoginRequest(
            name="Akagami",
            password="123",
        )


def test_registration_ignores_legacy_optional_email_payload():
    user = UserCreate(
        name="Akagami",
        password="Password123!",
        email="legacy-client@example.test",
    )

    assert user.name == "Akagami"
    assert not hasattr(user, "email")
