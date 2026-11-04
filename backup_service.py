"""Daily SQLite backup. Copies are taken with SQLite's online backup API, so they are
consistent even while the app is writing. Stored in data/backups/ (never served)."""
import glob
import os
import sqlite3
from datetime import datetime, timedelta, timezone

KEEP_DAYS = 14
IST = timezone(timedelta(hours=5, minutes=30))


def _db_path(app):
    uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    return uri.replace('sqlite:///', '', 1) if uri.startswith('sqlite:///') else None


def backup_if_due(app, force=False):
    """→ dict describing what happened. Makes at most one backup per IST day."""
    src = _db_path(app)
    if not src or not os.path.exists(src):
        return {'backup': 'skipped', 'reason': 'not a SQLite database'}
    folder = os.path.join(os.path.dirname(src), 'backups')
    os.makedirs(folder, exist_ok=True)
    today = datetime.now(IST).strftime('%Y-%m-%d')
    target = os.path.join(folder, f'ipo_saas-{today}.sqlite')
    if os.path.exists(target) and not force:
        return {'backup': 'exists', 'file': os.path.basename(target)}
    tmp = target + '.part'
    src_conn = sqlite3.connect(src)
    dst_conn = sqlite3.connect(tmp)
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()
    os.replace(tmp, target)
    # keep the newest KEEP_DAYS copies
    copies = sorted(glob.glob(os.path.join(folder, 'ipo_saas-*.sqlite')))
    for old in copies[:-KEEP_DAYS]:
        os.remove(old)
    return {'backup': 'created', 'file': os.path.basename(target), 'kept': min(len(copies), KEEP_DAYS)}
