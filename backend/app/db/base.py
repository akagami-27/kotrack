"""
Declarative base shared by all ORM models.

Alembic's env.py imports `Base.metadata` from here, and it also imports the
`app.models` package (see app/models/__init__.py) so every model is
registered on this metadata before autogenerate/migrations run.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass
