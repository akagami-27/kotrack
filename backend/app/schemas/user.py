from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole


class UserBase(BaseModel):
    name: str


class UserCreate(UserBase):
    """Input schema for creating a normal user."""

    password: str = Field(min_length=8)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    avatar_data: str | None = None


class UserUpdate(BaseModel):
    """
    Fields a user may change on their profile.

    name:
        Optional. If omitted, the current name is kept.

    avatar_data:
        - Omitted -> keep current avatar.
        - null -> remove current avatar.
        - data:image/webp;base64,... -> replace avatar.
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