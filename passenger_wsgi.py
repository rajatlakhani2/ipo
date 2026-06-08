"""
cPanel / SpidyHost Passenger entry point.
Passenger often uses system Python; packages live in the cPanel virtualenv.
"""
import glob
import os
import sys
import traceback

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.expanduser('~')


def _bootstrap_venv():
    """Load site-packages from cPanel virtualenv without os.execl (safe on import)."""
    venv_root = os.path.join(HOME, 'virtualenv', 'ipo.kuhu.org.in')
    if not os.path.isdir(venv_root):
        return
    for sp in sorted(glob.glob(os.path.join(venv_root, '*', 'lib', 'python3.*', 'site-packages')), reverse=True):
        if sp not in sys.path:
            sys.path.insert(0, sp)
    for activate in sorted(glob.glob(os.path.join(venv_root, '*', 'bin', 'activate_this.py')), reverse=True):
        try:
            with open(activate, encoding='utf-8') as fh:
                exec(f.read(), {'__file__': activate})
            break
        except Exception:
            pass


_bootstrap_venv()

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
