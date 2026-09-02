"""Reset KoTrack application data while keeping every user account."""

import psycopg
from app.core.config import get_settings
from sqlalchemy.engine import make_url


TABLES_TO_CLEAR = [
    "session_participants",
    "session_request_participants",
    "payments",
    "session_requests",
    "drink_sessions",
    "password_reset_requests",
]


settings = get_settings()
url = make_url(settings.DATABASE_URL)

print(f"Database: {url.database}")
print("This will DELETE ALL records from:")
for table in TABLES_TO_CLEAR:
    print(f"  - {table}")
print("The users table will NOT be touched.")

answer = input("Type RESET to continue: ").strip()
if answer != "RESET":
    print("Cancelled. No data was changed.")
    raise SystemExit(0)

conn = psycopg.connect(
    host=url.host,
    port=url.port,
    user=url.username,
    password=url.password,
    dbname=url.database,
)

try:
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "TRUNCATE TABLE "
            + ", ".join(TABLES_TO_CLEAR)
            + " RESTART IDENTITY CASCADE"
        )

    print("Reset complete.")
    print("All application/test records were cleared.")
    print("users table was preserved.")
finally:
    conn.close()
