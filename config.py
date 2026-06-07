import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


def _database_uri():
    url = os.environ.get('DATABASE_URL')
    if url:
        if url.startswith('postgres://'):
            url = url.replace('postgres://', 'postgresql://', 1)
        return url
    data_dir = os.path.join(BASE_DIR, 'data')
    os.makedirs(data_dir, exist_ok=True)
    return 'sqlite:///' + os.path.join(data_dir, 'ipo_saas.sqlite')


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'ipo-saas-dev-change-in-production')
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', '168'))
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')

    APP_BASE_URL = os.environ.get('APP_BASE_URL', 'http://127.0.0.1:5001')
    REQUIRE_EMAIL_VERIFICATION = os.environ.get('REQUIRE_EMAIL_VERIFICATION', 'false').lower() == 'true'

    MAIL_SERVER = os.environ.get('MAIL_SERVER', '')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', '587'))
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_FROM = os.environ.get('MAIL_FROM', 'IPO Control <noreply@ipocontrol.app>')

    STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
    STRIPE_PRICE_ID_PRO = os.environ.get('STRIPE_PRICE_ID_PRO', '')

    KITE_API_KEY = os.environ.get('KITE_API_KEY', '')
    KITE_API_SECRET = os.environ.get('KITE_API_SECRET', '')
    KITE_REDIRECT_URL = os.environ.get('KITE_REDIRECT_URL', '')

    PLAN_LIMITS = {
        'free': {'max_investors': 15, 'max_ipos': 10, 'max_members': 3},
        'pro': {'max_investors': 9999, 'max_ipos': 9999, 'max_members': 25},
    }
