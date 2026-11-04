import os
from flask import Flask, send_file, send_from_directory, jsonify
from flask_cors import CORS

from config import Config
from extensions import db
from routes import api_bp, auth_bp
from billing_routes import billing_bp
from family_office_routes import fo_bp
from broker_routes import broker_public_bp


APP_ROOT = os.path.dirname(os.path.abspath(__file__))

# Only these file types may be served to browsers. Everything else in the app
# folder (database, .env, .git, *.py, logs, Excel files, backups) stays private.
PUBLIC_EXTENSIONS = {
    '.html', '.js', '.css', '.map',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot',
}
# Folders whose contents are never public, even if a file has an allowed extension.
PRIVATE_DIRS = {'data', 'tmp', 'nginx', 'venv', '.venv', '__pycache__', 'node_modules'}
# Test / scratch pages that shouldn't be reachable on the live site.
PRIVATE_FILES = {'test-dashboard.html', 'test-demo.html', 'attractive_dashboard.html'}


def _is_public(path):
    parts = path.replace('\\', '/').split('/')
    if any(p in ('', '.', '..') or p.startswith('.') for p in parts):
        return False  # hidden files (.env, .git, .htaccess) and traversal
    if parts[0] in PRIVATE_DIRS or parts[-1] in PRIVATE_FILES:
        return False
    return os.path.splitext(parts[-1])[1].lower() in PUBLIC_EXTENSIONS


def create_app():
    # static_folder=None: turn off Flask's built-in "serve everything" static route.
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    CORS(app, resources={r'/api/*': {'origins': Config.CORS_ORIGINS}})

    db.init_app(app)
    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(billing_bp)
    app.register_blueprint(fo_bp)
    app.register_blueprint(broker_public_bp)

    with app.app_context():
        try:
            from migrate_schema import apply_migrations
            apply_migrations(app)
            db.create_all()
            _seed_upcoming_ipos()
        except Exception as exc:
            app.logger.error('Database init failed: %s', exc)
        if os.environ.get('DISABLE_BACKGROUND_JOBS', '').lower() != 'true':
            try:
                from scheduler_service import start_background_jobs
                start_background_jobs(app)
            except Exception as exc:
                app.logger.warning('Background jobs disabled: %s', exc)

    @app.route('/')
    def index():
        return send_file('index.html')

    @app.route('/login.html')
    def login_page():
        return send_file('login.html')

    @app.route('/verify.html')
    def verify_page():
        return send_file('verify.html')

    @app.route('/<path:path>')
    def static_files(path):
        if path.startswith('api/') or not _is_public(path):
            return jsonify({'error': 'Not found'}), 404
        # send_from_directory refuses paths that escape APP_ROOT
        return send_from_directory(APP_ROOT, path)

    @app.route('/api/cron/sync', methods=['GET', 'POST'])
    def cron_sync():
        """For a cPanel Cron Job: curl -s 'https://ipo.kuhu.org.in/api/cron/sync?key=YOUR_CRON_KEY'"""
        import hmac
        from flask import request
        expected = os.environ.get('CRON_KEY', '')
        given = request.args.get('key', '') or request.headers.get('X-Cron-Key', '')
        if not expected or not hmac.compare_digest(expected, given):
            return jsonify({'error': 'Forbidden'}), 403
        from family_office_routes import _run_sync_safely
        result = _run_sync_safely(app)
        if result is None:
            return jsonify({'message': 'Sync already running'}), 202
        return jsonify({k: v for k, v in result.items() if k != 'errors'} | {'error_count': len(result['errors'])})

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'product': 'Family Office Dashboard'})

    return app


def _seed_upcoming_ipos():
    from models import UpcomingIPO
    if UpcomingIPO.query.count() > 0:
        return
    samples = [
        UpcomingIPO(
            ipo_name='Sample Mainboard IPO',
            ipo_type='Mainboard',
            ipo_status='upcoming',
            source='manual',
            external_id='sample-mainboard',
            price_band_low=100,
            price_band_high=105,
            lot_size=50,
        ),
        UpcomingIPO(
            ipo_name='Sample SME IPO',
            ipo_type='SME',
            ipo_status='upcoming',
            source='manual',
            external_id='sample-sme',
            price_band_low=80,
            price_band_high=84,
            lot_size=1200,
        ),
    ]
    for s in samples:
        db.session.add(s)
    db.session.commit()


if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, host='0.0.0.0', port=port)
