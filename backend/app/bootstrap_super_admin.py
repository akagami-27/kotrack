"""Explicit bootstrap for the first super-admin account.

Safe, manual setup (run from backend/):

    python -m app.bootstrap_super_admin --user-id 12 --database-name kotrack
    python -m app.bootstrap_super_admin --user-id 12 --database-name kotrack --apply

The first command is a dry run. The second changes one existing active ADMIN
to SUPER_ADMIN only after matching the configured DATABASE_URL database name.
It never creates accounts, accepts passwords, or promotes a user by default.
Review the target database and account before passing --apply.
"""

import argparse

from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.enums import UserRole
from app.models.user import User


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--database-name", required=True)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the promotion; without this flag the command is a dry run.",
    )
    args = parser.parse_args()

    database_url = get_settings().DATABASE_URL
    configured_database = make_url(database_url).database
    if configured_database != args.database_name:
        parser.error("--database-name does not match DATABASE_URL")

    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with Session(engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(724193018)"))
            existing = list(
                db.scalars(
                    select(User)
                    .where(User.role == UserRole.SUPER_ADMIN)
                    .order_by(User.id)
                    .with_for_update()
                ).all()
            )
            if existing:
                parser.error("A super-admin already exists; bootstrap refused")

            target = db.scalar(
                select(User)
                .where(User.id == args.user_id)
                .with_for_update()
            )
            if (
                target is None
                or not target.is_active
                or target.role != UserRole.ADMIN
            ):
                parser.error("Target must be an existing active ADMIN account")

            if args.apply:
                target.role = UserRole.SUPER_ADMIN
                db.flush()
                print("Bootstrap applied to the explicitly selected account.")
            else:
                print(
                    "Dry run only: the explicitly selected active ADMIN is "
                    "eligible. Re-run with --apply after verifying the target."
                )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
