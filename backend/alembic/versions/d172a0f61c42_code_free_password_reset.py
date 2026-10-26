"""Add server-bound, code-free password-reset state."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d172a0f61c42"
down_revision: Union[str, Sequence[str], None] = "c840a2b9d13f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("password_reset_requests", sa.Column("status", sa.String(16), server_default="PENDING", nullable=False))
    op.add_column("password_reset_requests", sa.Column("reset_session_hash", sa.String(64), nullable=True))
    op.add_column("password_reset_requests", sa.Column("session_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("password_reset_requests", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(sa.text("""
        UPDATE password_reset_requests SET status = CASE
          WHEN rejected_at IS NOT NULL THEN 'REJECTED'
          WHEN used THEN 'CLOSED_LEGACY'
          WHEN approved_at IS NOT NULL THEN 'CLOSED_LEGACY'
          ELSE 'PENDING' END
    """))
    # Invalidate every legacy reset code. Approval through the old flow must
    # never authorize the new cookie-bound flow.
    op.execute(sa.text("UPDATE password_reset_requests SET code_hash = NULL, expires_at = NULL"))
    op.execute(sa.text("""
        WITH ranked AS (
          SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
          FROM password_reset_requests WHERE status = 'PENDING'
        )
        UPDATE password_reset_requests AS request
        SET status = 'CLOSED_LEGACY'
        FROM ranked WHERE request.id = ranked.id AND ranked.rn > 1
    """))
    op.create_check_constraint(
        "ck_password_reset_requests_status",
        "password_reset_requests",
        "status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED_LEGACY')",
    )
    op.create_index(
        "uq_password_reset_open_request_per_user",
        "password_reset_requests",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('PENDING', 'APPROVED')"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    active = bind.execute(sa.text(
        "SELECT count(*) FROM password_reset_requests WHERE status IN ('PENDING','APPROVED')"
    )).scalar_one()
    if active:
        raise RuntimeError("Refusing downgrade while code-free reset requests are active")
    completed = bind.execute(sa.text(
        "SELECT count(*) FROM password_reset_requests WHERE status = 'COMPLETED' OR completed_at IS NOT NULL"
    )).scalar_one()
    if completed:
        raise RuntimeError("Refusing downgrade: completed-reset audit records exist; use a forward recovery migration")
    op.drop_index("uq_password_reset_open_request_per_user", table_name="password_reset_requests")
    op.drop_constraint("ck_password_reset_requests_status", "password_reset_requests", type_="check")
    op.drop_column("password_reset_requests", "completed_at")
    op.drop_column("password_reset_requests", "session_expires_at")
    op.drop_column("password_reset_requests", "reset_session_hash")
    op.drop_column("password_reset_requests", "status")
