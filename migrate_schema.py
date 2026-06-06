"""Add new columns to existing DB (safe to run multiple times)."""
import os
import sqlite3

from config import Config

SQLITE_ALTERS = [
    "ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0",
    "ALTER TABLE users ADD COLUMN verification_token VARCHAR(64)",
    "ALTER TABLE users ADD COLUMN verification_sent_at DATETIME",
    "ALTER TABLE organizations ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'none'",
    "ALTER TABLE organizations ADD COLUMN stripe_customer_id VARCHAR(100)",
    "ALTER TABLE organizations ADD COLUMN stripe_subscription_id VARCHAR(100)",
    "ALTER TABLE upcoming_ipos ADD COLUMN ipo_status VARCHAR(50) DEFAULT 'upcoming'",
    "ALTER TABLE upcoming_ipos ADD COLUMN source VARCHAR(50) DEFAULT 'manual'",
    "ALTER TABLE upcoming_ipos ADD COLUMN external_id VARCHAR(100)",
    "ALTER TABLE upcoming_ipos ADD COLUMN source_url VARCHAR(500)",
    "ALTER TABLE upcoming_ipos ADD COLUMN total_subscription FLOAT",
    "ALTER TABLE upcoming_ipos ADD COLUMN last_synced_at DATETIME",
    "ALTER TABLE investors ADD COLUMN pan VARCHAR(20)",
    "ALTER TABLE investors ADD COLUMN demat_account VARCHAR(50)",
    "ALTER TABLE investors ADD COLUMN broker VARCHAR(100)",
    "ALTER TABLE investors ADD COLUMN relationship VARCHAR(50)",
    "ALTER TABLE investors ADD COLUMN priority_rank INTEGER DEFAULT 99",
    "ALTER TABLE investors ADD COLUMN risk_category VARCHAR(20) DEFAULT 'Medium'",
    "ALTER TABLE investors ADD COLUMN profit_sharing_pct FLOAT DEFAULT 0",
    "ALTER TABLE investors ADD COLUMN is_active BOOLEAN DEFAULT 1",
    "ALTER TABLE ipos ADD COLUMN gmp FLOAT",
    "ALTER TABLE ipos ADD COLUMN ipo_score FLOAT",
    "ALTER TABLE ipos ADD COLUMN ai_rating VARCHAR(10)",
    "ALTER TABLE ipos ADD COLUMN risk_rating VARCHAR(10)",
    "ALTER TABLE ipos ADD COLUMN subscription_times FLOAT",
    "ALTER TABLE ipos ADD COLUMN expected_listing_gain FLOAT",
    "ALTER TABLE ipos ADD COLUMN funding_requirement FLOAT",
    "ALTER TABLE applications ADD COLUMN kanban_stage VARCHAR(50) DEFAULT 'Applied'",
    "ALTER TABLE broker_connections ADD COLUMN access_token VARCHAR(500)",
    "ALTER TABLE broker_connections ADD COLUMN oauth_state VARCHAR(64)",
    "ALTER TABLE broker_connections ADD COLUMN token_expires_at DATETIME",
    "ALTER TABLE applications ADD COLUMN registrar_check_status VARCHAR(50)",
    "ALTER TABLE applications ADD COLUMN registrar_checked_at DATETIME",
]


def migrate_sqlite(path):
    if not path or not os.path.exists(path):
        return
    conn = sqlite3.connect(path)
    for sql in SQLITE_ALTERS:
        try:
            conn.execute(sql)
            conn.commit()
        except sqlite3.OperationalError as e:
            if 'duplicate column' not in str(e).lower():
                pass
    try:
        conn.execute(
            "UPDATE users SET email_verified = 1 "
            "WHERE verification_token IS NULL AND (email_verified IS NULL OR email_verified = 0)"
        )
        conn.commit()
    except sqlite3.OperationalError:
        pass
    conn.close()


POSTGRES_COLUMNS = [
    ('investors', 'pan', 'VARCHAR(20)'),
    ('investors', 'demat_account', 'VARCHAR(50)'),
    ('investors', 'broker', 'VARCHAR(100)'),
    ('investors', 'relationship', 'VARCHAR(50)'),
    ('investors', 'priority_rank', 'INTEGER DEFAULT 99'),
    ('investors', 'risk_category', 'VARCHAR(20) DEFAULT \'Medium\''),
    ('investors', 'profit_sharing_pct', 'FLOAT DEFAULT 0'),
    ('investors', 'is_active', 'BOOLEAN DEFAULT TRUE'),
    ('ipos', 'gmp', 'FLOAT'),
    ('ipos', 'ipo_score', 'FLOAT'),
    ('ipos', 'ai_rating', 'VARCHAR(10)'),
    ('ipos', 'risk_rating', 'VARCHAR(10)'),
    ('ipos', 'subscription_times', 'FLOAT'),
    ('ipos', 'expected_listing_gain', 'FLOAT'),
    ('ipos', 'funding_requirement', 'FLOAT'),
    ('applications', 'kanban_stage', 'VARCHAR(50) DEFAULT \'Applied\''),
    ('applications', 'registrar_check_status', 'VARCHAR(50)'),
    ('applications', 'registrar_checked_at', 'TIMESTAMP'),
    ('broker_connections', 'access_token', 'VARCHAR(500)'),
    ('broker_connections', 'oauth_state', 'VARCHAR(64)'),
    ('broker_connections', 'token_expires_at', 'TIMESTAMP'),
]


def migrate_postgres(uri):
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(uri.replace('postgres://', 'postgresql://', 1))
        with engine.connect() as conn:
            for table, col, coltype in POSTGRES_COLUMNS:
                exists = conn.execute(text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name=:t AND column_name=:c"
                ), {'t': table, 'c': col}).fetchone()
                if not exists:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {coltype}'))
            conn.commit()
    except Exception:
        pass


def apply_migrations(app):
    """Run before db.create_all() / ORM queries on startup."""
    uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if uri.startswith('sqlite'):
        path = uri.replace('sqlite:///', '')
        migrate_sqlite(path)
    elif uri.startswith('postgres'):
        migrate_postgres(uri)


if __name__ == '__main__':
    from app import create_app
    from extensions import db

    app = create_app()
    with app.app_context():
        apply_migrations(app)
        db.create_all()
        print('Schema migration done.')
