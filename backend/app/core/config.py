"""
Application configuration.

All configuration is sourced from environment variables (optionally loaded
from a local .env file for development). Nothing sensitive is hardcoded.
"""
from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Example: postgresql+psycopg://username:password@host:5432/drink_tracker
    DATABASE_URL: str

    # Fallback price per packet (RM) when a session does not specify one.
    DEFAULT_PRICE_PER_PACKET: Decimal = Decimal("25.00")

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so the environment is only parsed once."""
    return Settings()
