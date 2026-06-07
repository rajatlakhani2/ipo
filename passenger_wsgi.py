"""
cPanel / SpidyHost Passenger entry point.
Setup Python App → Application startup file: passenger_wsgi.py
"""
import os
import sys

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)
os.chdir(APP_ROOT)
os.makedirs(os.path.join(APP_ROOT, 'data'), exist_ok=True)

# Shared hosting: skip background threads unless explicitly enabled
os.environ.setdefault('DISABLE_BACKGROUND_JOBS', 'true')

from app import create_app

application = create_app()
