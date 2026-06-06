"""Zerodha Kite Connect — OAuth + live holdings sync."""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta

import requests
from flask import current_app

logger = logging.getLogger(__name__)

KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login'
KITE_API_BASE = 'https://api.kite.trade'
KITE_VERSION = '3'


def kite_configured():
    return bool(
        current_app.config.get('KITE_API_KEY')
        and current_app.config.get('KITE_API_SECRET')
    )


def kite_redirect_uri():
    base = current_app.config.get('APP_BASE_URL', 'http://127.0.0.1:5001').rstrip('/')
    custom = current_app.config.get('KITE_REDIRECT_URL')
    return custom or f'{base}/broker/zerodha/callback'


def build_login_url(state):
    api_key = current_app.config['KITE_API_KEY']
    return f'{KITE_LOGIN_URL}?v={KITE_VERSION}&api_key={api_key}&state={state}'


def _checksum(api_key, request_token, api_secret):
    raw = f'{api_key}{request_token}{api_secret}'.encode()
    return hashlib.sha256(raw).hexdigest()


def exchange_request_token(request_token):
    """Return session dict from Kite or raise KiteError."""
    api_key = current_app.config['KITE_API_KEY']
    api_secret = current_app.config['KITE_API_SECRET']
    resp = requests.post(
        f'{KITE_API_BASE}/session/token',
        headers={'X-Kite-Version': KITE_VERSION},
        data={
            'api_key': api_key,
            'request_token': request_token,
            'checksum': _checksum(api_key, request_token, api_secret),
        },
        timeout=20,
    )
    data = resp.json()
    if resp.status_code != 200 or data.get('status') != 'success':
        msg = data.get('message') or resp.text
        raise RuntimeError(f'Kite session failed: {msg}')
    return data.get('data', {})


def _auth_headers(access_token):
    api_key = current_app.config['KITE_API_KEY']
    return {
        'X-Kite-Version': KITE_VERSION,
        'Authorization': f'token {api_key}:{access_token}',
    }


def fetch_holdings(access_token):
    resp = requests.get(
        f'{KITE_API_BASE}/portfolio/holdings',
        headers=_auth_headers(access_token),
        timeout=20,
    )
    data = resp.json()
    if resp.status_code != 200 or data.get('status') != 'success':
        raise RuntimeError(data.get('message') or 'Failed to fetch holdings')
    return data.get('data', [])


def fetch_quote_ltp(access_token, instruments):
    """instruments: list like ['NSE:RELIANCE', 'NSE:TCS']"""
    if not instruments:
        return {}
    resp = requests.get(
        f'{KITE_API_BASE}/quote/ltp',
        headers=_auth_headers(access_token),
        params={'i': instruments[:200]},
        timeout=20,
    )
    data = resp.json()
    if resp.status_code != 200 or data.get('status') != 'success':
        return {}
    return data.get('data', {})


def new_oauth_state():
    return secrets.token_urlsafe(32)


def default_token_expiry():
    """Kite tokens expire at ~6 AM IST next day; approximate 18h."""
    return datetime.utcnow() + timedelta(hours=18)


def sync_connection_holdings(connection):
    """Pull holdings from Kite into DB for a BrokerConnection."""
    from extensions import db
    from models import Holding

    if not connection.access_token:
        raise RuntimeError('Not connected to Zerodha')

    raw = fetch_holdings(connection.access_token)
    Holding.query.filter_by(broker_connection_id=connection.id).delete()

    symbols_for_quote = []
    rows = []
    for h in raw:
        sym = h.get('tradingsymbol') or h.get('symbol')
        if not sym:
            continue
        exch = h.get('exchange', 'NSE')
        symbols_for_quote.append(f'{exch}:{sym}')
        qty = float(h.get('quantity') or h.get('opening_quantity') or 0)
        avg = float(h.get('average_price') or 0)
        ltp = float(h.get('last_price') or avg)
        day_chg = float(h.get('day_change_percentage') or 0)
        rows.append({
            'symbol': sym,
            'quantity': qty,
            'avg_price': avg,
            'ltp': ltp,
            'day_change_pct': day_chg,
            'instrument': f'{exch}:{sym}',
            'product': h.get('product', 'EQ'),
        })

    ltp_map = fetch_quote_ltp(connection.access_token, [r['instrument'] for r in rows])
    for r in rows:
        q = ltp_map.get(r['instrument'], {})
        if q and 'last_price' in q:
            r['ltp'] = float(q['last_price'])

        db.session.add(Holding(
            organization_id=connection.organization_id,
            investor_id=connection.investor_id,
            broker_connection_id=connection.id,
            symbol=r['symbol'],
            quantity=r['quantity'],
            avg_price=r['avg_price'],
            ltp=r['ltp'],
            day_change_pct=r['day_change_pct'],
            asset_type='Stock',
            sector=r.get('product', 'EQ'),
        ))

    connection.last_synced_at = datetime.utcnow()
    connection.is_connected = True
    db.session.commit()
    return {'synced': len(rows)}
