"""Read-only-safety coverage for the conditional settlement migration."""

import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def load_migration():
    migration_path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "b3c0f16e8a92_add_inter_handler_settlements.py"
    )
    spec = importlib.util.spec_from_file_location(
        "inter_handler_settlement_migration",
        migration_path,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_upgrade_creates_settlement_table_when_missing():
    migration = load_migration()
    engine = create_engine("sqlite+pysqlite:///:memory:")

    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()

        columns = {
            column["name"]
            for column in inspect(connection).get_columns(
                "inter_handler_settlements"
            )
        }

    assert columns == {
        "id",
        "payer_handler_id",
        "payee_handler_id",
        "amount",
        "status",
        "created_at",
        "paid_at",
        "notes",
    }
    engine.dispose()


def test_upgrade_preserves_an_existing_settlement_table_and_rows():
    migration = load_migration()
    engine = create_engine("sqlite+pysqlite:///:memory:")

    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        connection.execute(text(
            "CREATE TABLE inter_handler_settlements ("
            "id INTEGER PRIMARY KEY, payer_handler_id INTEGER NOT NULL, "
            "payee_handler_id INTEGER NOT NULL, amount NUMERIC(10, 2) NOT NULL, "
            "status VARCHAR(20) NOT NULL, created_at TIMESTAMP NOT NULL, "
            "paid_at TIMESTAMP, notes TEXT)"
        ))
        connection.execute(text(
            "INSERT INTO inter_handler_settlements "
            "(id, payer_handler_id, payee_handler_id, amount, status, created_at) "
            "VALUES (1, 2, 9, 8.58, 'PENDING', CURRENT_TIMESTAMP)"
        ))

        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()

        row = connection.execute(text(
            "SELECT id, payer_handler_id, payee_handler_id, amount, status "
            "FROM inter_handler_settlements"
        )).one()
        with Operations.context(context):
            migration.downgrade()
        still_exists = inspect(connection).has_table("inter_handler_settlements")

    assert row == (1, 2, 9, 8.58, "PENDING")
    assert still_exists
    engine.dispose()
