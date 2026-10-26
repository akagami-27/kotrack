from datetime import datetime

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import UserRole


class UserBase(BaseModel):
    name: str


class UserCreate(UserBase):
    """Input schema for creating a normal user."""

    password: str = Field(min_length=8)
    email: str | None = Field(default=None, max_length=320)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    avatar_data: str | None = None


class SuperAdminUserRead(BaseModel):
    """Limited account fields exposed only to super administrators."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserUpdate(BaseModel):
    """
    Fields a user may change on their profile.

    name:
        Optional. If omitted, the current name is kept.

    avatar_data:
        - Omitted -> keep current avatar.
        - null -> remove current avatar.
        - JPEG or WebP data URL -> replace avatar.
    """

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    avatar_data: str | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=8)
    new_password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    name: str
    password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class PasswordResetRequestCreate(BaseModel):
    name: str

class PasswordResetConfirm(BaseModel):
    name: str
    code: str
    new_password: str
