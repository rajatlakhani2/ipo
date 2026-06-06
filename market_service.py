"""Live market value engine — NSE price fetch with fallback simulation."""
import random
from datetime import datetime

import requests

from models import Holding
from extensions import db

_price_cache = {}
_last_fetch = None

NSE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
}


def _fetch_nse_quote(symbol):
    try:
        session = requests.Session()
        session.get('https://www.nseindia.com', headers=NSE_HEADERS, timeout=5)
        url = f'https://www.nseindia.com/api/quote-equity?symbol={symbol}'
        r = session.get(url, headers=NSE_HEADERS, timeout=8)
        if r.status_code == 200:
            data = r.json()
            price = data.get('priceInfo', {}).get('lastPrice')
            change = data.get('priceInfo', {}).get('pChange', 0)
            if price:
                return float(price), float(change or 0)
    except Exception:
        pass
    return None, None


def refresh_holdings_prices(org_id=None):
    global _last_fetch
    q = Holding.query
    if org_id:
        q = q.filter_by(organization_id=org_id)
    holdings = q.all()
    updated = 0
    for h in holdings:
        ltp, chg = _fetch_nse_quote(h.symbol)
        if ltp is None:
            base = h.ltp or h.avg_price or 100
            jitter = random.uniform(-0.015, 0.015)
            ltp = round(base * (1 + jitter), 2)
            chg = round(jitter * 100, 2)
        h.ltp = ltp
        h.day_change_pct = chg
        _price_cache[h.symbol] = {'ltp': ltp, 'change': chg, 'at': datetime.utcnow().isoformat()}
        updated += 1
    db.session.commit()
    _last_fetch = datetime.utcnow()
    return {'updated': updated, 'last_fetch': _last_fetch.isoformat()}


def get_market_pulse(org_id):
    holdings = Holding.query.filter_by(organization_id=org_id).all()
    if not holdings:
        return {
            'today_gain': 0, 'today_loss': 0,
            'top_gainer': None, 'top_loser': None,
            'last_updated': _last_fetch.isoformat() if _last_fetch else None,
        }
    gainers = sorted(holdings, key=lambda h: h.day_change_pct or 0, reverse=True)
    total_gain = sum(h.pnl for h in holdings if (h.day_change_pct or 0) > 0)
    total_loss = sum(abs(h.pnl) for h in holdings if (h.day_change_pct or 0) < 0)
    top_g = gainers[0] if gainers else None
    top_l = gainers[-1] if gainers else None
    return {
        'today_gain': round(total_gain, 2),
        'today_loss': round(total_loss, 2),
        'top_gainer': top_g.to_dict() if top_g else None,
        'top_loser': top_l.to_dict() if top_l else None,
        'last_updated': _last_fetch.isoformat() if _last_fetch else datetime.utcnow().isoformat(),
    }
