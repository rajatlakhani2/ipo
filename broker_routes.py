"""Public broker OAuth callbacks (no JWT)."""
from datetime import datetime

from flask import Blueprint, redirect, request, current_app

from extensions import db
from models import BrokerConnection
from kite_service import (
    exchange_request_token, sync_connection_holdings,
    default_token_expiry, kite_configured,
)

broker_public_bp = Blueprint('broker_public', __name__)


@broker_public_bp.route('/broker/zerodha/callback')
def zerodha_callback():
    """Kite redirects here with request_token and state."""
    if not kite_configured():
        return redirect('/?broker_error=kite_not_configured')

    status = request.args.get('status')
    request_token = request.args.get('request_token')
    state = request.args.get('state')

    if status != 'success' or not request_token or not state:
        return redirect('/?broker_error=zerodha_denied')

    conn = BrokerConnection.query.filter_by(oauth_state=state, broker_name='Zerodha').first()
    if not conn:
        return redirect('/?broker_error=invalid_state')

    try:
        session = exchange_request_token(request_token)
        conn.access_token = session.get('access_token')
        conn.client_id = session.get('user_id') or conn.client_id
        conn.oauth_state = None
        conn.is_connected = True
        conn.token_expires_at = default_token_expiry()
        conn.last_synced_at = datetime.utcnow()
        db.session.commit()
        sync_connection_holdings(conn)
    except Exception as exc:
        current_app.logger.exception('Zerodha callback failed')
        conn.is_connected = False
        conn.oauth_state = None
        db.session.commit()
        return redirect(f'/?broker_error={str(exc)[:80]}')

    return redirect('/?broker=zerodha_connected')
