"""Shared enum types used across ORM models."""
import enum


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


def is_admin_role(role: UserRole) -> bool:
    return role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
