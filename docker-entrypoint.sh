#!/bin/sh
set -e

echo "Waiting for database..."
python - <<'PY'
import os, time, sys
url = os.environ.get("DATABASE_URL", "")
if not url.startswith("postgresql"):
    sys.exit(0)
for i in range(30):
    try:
        from sqlalchemy import create_engine
        e = create_engine(url.replace("postgres://", "postgresql://", 1))
        with e.connect() as c:
            c.execute(__import__("sqlalchemy").text("SELECT 1"))
        print("Database ready.")
        break
    except Exception:
        time.sleep(2)
else:
    print("Database not ready", file=sys.stderr)
    sys.exit(1)
PY

echo "Running Family Office schema migrations..."
python migrate_schema.py
python -c "from app import create_app; from extensions import db; app=create_app(); ctx=app.app_context(); ctx.push(); db.create_all(); print('Tables ready.')"
exec "$@"
