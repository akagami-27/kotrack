"""Add super-admin role, optional user email, and session handlers.

Revision ID: a2190d9f7c31
Revises: d3896ea15b0f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2190d9f7c31"
down_revision: Union[str, Sequence[str], None] = "d3896ea15b0f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL requires a commit boundary before a newly added enum value
    # can be used by subsequent statements in the same migration.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'")

    op.add_column(
        "users",
        sa.Column("email", sa.String(length=320), nullable=True),
    )
    op.create_index(
        "uq_users_email_lower",
        "users",
        [sa.text("lower(email)")],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )

    op.add_column(
        "drink_sessions",
        sa.Column("handler_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "drink_sessions",
        sa.Column("creator_role_at_creation", sa.String(length=20), nullable=True),
    )
    op.create_foreign_key(
        "fk_drink_sessions_handler_id_users",
        "drink_sessions",
        "users",
        ["handler_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_drink_sessions_handler_id",
        "drink_sessions",
        ["handler_id"],
    )

    op.add_column(
        "session_requests",
        sa.Column("handler_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_session_requests_handler_id_users",
        "session_requests",
        "users",
        ["handler_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_session_requests_handler_id",
        "session_requests",
        ["handler_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_session_requests_handler_id", table_name="session_requests")
    op.drop_constraint(
        "fk_session_requests_handler_id_users",
        "session_requests",
        type_="foreignkey",
    )
    op.drop_column("session_requests", "handler_id")

    op.drop_index("ix_drink_sessions_handler_id", table_name="drink_sessions")
    op.drop_constraint(
        "fk_drink_sessions_handler_id_users",
        "drink_sessions",
        type_="foreignkey",
    )
    op.drop_column("drink_sessions", "handler_id")
    op.drop_column("drink_sessions", "creator_role_at_creation")

    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_column("users", "email")

    # PostgreSQL does not support dropping an enum label in place. The
    # SUPER_ADMIN label remains unused after downgrade.
