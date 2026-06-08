"""
cPanel / SpidyHost Passenger entry point.
Setup Python App → Application startup file: passenger_wsgi.py
"""
import os
import sys
import traceback

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)
os.chdir(APP_ROOT)
os.makedirs(os.path.join(APP_ROOT, 'data'), exist_ok=True)

os.environ.setdefault('DISABLE_BACKGROUND_JOBS', 'true')

try:
    from app import create_app
    application = create_app()
except Exception:
    with open(os.path.join(APP_ROOT, 'startup_error.log'), 'w', encoding='utf-8') as f:
        f.write(traceback.format_exc())
    raise
