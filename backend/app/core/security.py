"""
Authentication and security helpers.

Passwords are hashed with Argon2.
Authenticated users receive signed JWT access tokens.
"""

from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

settings = get_settings()

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its stored Argon2 hash."""
    return password_hash.verify(password, hashed_password)


def create_access_token(
    *,
    user_id: int,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token."""

    if expires_delta is None:
        expires_delta = timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )

    expire = datetime.now(timezone.utc) + expires_delta

    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )