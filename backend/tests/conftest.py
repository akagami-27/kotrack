"""
Shared pytest fixtures.

Database tests require a dedicated PostgreSQL test database.

Set TEST_DATABASE_URL before running pytest:

    TEST_DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/drink_tracker_test

Never point TEST_DATABASE_URL at your normal development or production database.
"""

import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
import app.models  # noqa: F401


@pytest.fixture(scope="session")
def engine():
    database_url = os.environ.get("TEST_DATABASE_URL")

    if not database_url:
        pytest.fail(
            "TEST_DATABASE_URL is not set. "
            "Refusing to run database tests against an unknown database."
        )

    if "drink_tracker_test" not in database_url:
        pytest.fail(
            "TEST_DATABASE_URL must point to a dedicated test database "
            "named 'drink_tracker_test'."
        )

    eng = create_engine(database_url, future=True)

    Base.metadata.create_all(eng)

    yield eng

    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db(engine) -> Session:
    """Provide a database session isolated inside a rollback transaction."""
    connection = engine.connect()
    transaction = connection.begin()

    SessionLocal = sessionmaker(
        bind=connection,
        future=True,
    )

    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()

        if transaction.is_active:
            transaction.rollback()

        connection.close()