
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Make the app package importable from the backend directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Load the local .env file when available.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Prefer DATABASE_URL from the environment.
database_url = os.environ.get("DATABASE_URL")

if database_url:
    config.set_main_option(
        "sqlalchemy.url",
        database_url.replace("%", "%%"),
    )

target_metadata = Base.metadata


def include_object(object_, name, type_, reflected, compare_to):
    """Keep legacy columns and indexes in historical databases."""

    if (
        reflected
        and type_ == "column"
        and name == "email"
        and getattr(object_.table, "name", None) == "users"
    ):
        return False

    if (
        reflected
        and type_ == "column"
        and getattr(object_.table, "name", None)
        == "password_reset_requests"
        and name in {"code_hash", "expires_at", "attempts"}
    ):
        return False

    if reflected and type_ == "index" and name == "uq_users_email_lower":
        return False

    if (
        reflected
        and type_ == "index"
        and name == "ix_password_reset_requests_expires_at"
    ):
        return False

    return True


def run_migrations_offline() -> None:
    """Generate SQL without connecting to the database."""

    url = config.get_main_option("sqlalchemy.url")

    if not url or url.startswith("driver://"):
        raise RuntimeError(
            "DATABASE_URL is not configured. "
            "Set DATABASE_URL before running Alembic."
        )

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations using a database connection."""

    database_url = config.get_main_option("sqlalchemy.url")

    if not database_url or database_url.startswith("driver://"):
        raise RuntimeError(
            "DATABASE_URL is not configured. "
            "Set DATABASE_URL before running Alembic."
        )

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
