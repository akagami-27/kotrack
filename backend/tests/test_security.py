from datetime import timedelta

import jwt

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_and_verify():
    password = "TestPassword123!"

    hashed = hash_password(password)

    assert hashed != password
    assert hashed.startswith("$argon2")

    assert verify_password(password, hashed)
    assert not verify_password("WrongPassword123!", hashed)


def test_create_access_token_contains_expected_claims():
    token = create_access_token(
        user_id=123,
        role="USER",
    )

    settings = get_settings()

    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

    assert payload["sub"] == "123"
    assert payload["role"] == "USER"
    assert "exp" in payload


def test_create_access_token_accepts_custom_expiration():
    token = create_access_token(
        user_id=456,
        role="ADMIN",
        expires_delta=timedelta(minutes=5),
    )

    settings = get_settings()

    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

    assert payload["sub"] == "456"
    assert payload["role"] == "ADMIN"
    assert "exp" in payload