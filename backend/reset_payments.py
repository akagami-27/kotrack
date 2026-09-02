import psycopg
from app.core.config import get_settings
from sqlalchemy.engine import make_url

url = make_url(get_settings().DATABASE_URL)

conn = psycopg.connect(
    host=url.host,
    port=url.port,
    user=url.username,
    password=url.password,
    dbname=url.database,
)

conn.autocommit = True

cur = conn.cursor()

cur.execute("DELETE FROM payments")

print("Database:", url.database)
print("Deleted payments:", cur.rowcount)

conn.close()