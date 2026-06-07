import os
from flask import Flask, send_file, jsonify
from flask_cors import CORS

from config import Config
from extensions import db
from routes import api_bp, auth_bp
from billing_routes import billing_bp
from family_office_routes import fo_bp
from broker_routes import broker_public_bp


def create_app():
    app = Flask(__name__, static_folder='.', static_url_path='')
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
        if path.startswith('api/'):
            return jsonify({'error': 'Not found'}), 404
        try:
            return send_file(path)
        except FileNotFoundError:
            return jsonify({'error': 'File not found'}), 404

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
