"""Run inside cPanel virtualenv: python check_deps.py"""
import sys

print('Python:', sys.version)
print('Executable:', sys.executable)
print()

modules = [
    'flask', 'flask_cors', 'flask_sqlalchemy', 'jwt',
    'stripe', 'requests', 'bs4', 'openpyxl',
]
missing = []
for name in modules:
    try:
        __import__(name)
        print(f'OK  {name}')
    except ImportError as exc:
        print(f'MISSING  {name}: {exc}')
        missing.append(name)

print()
if missing:
    print('Install: pip install -r requirements-cpanel.txt')
    sys.exit(1)

try:
    from app import create_app
    application = create_app()
    client = application.test_client()
    r = client.get('/api/health')
    print('Health:', r.status_code, r.get_json())
except Exception as exc:
    import traceback
    print('App startup failed:')
    traceback.print_exc()
    sys.exit(1)

print('All checks passed.')
