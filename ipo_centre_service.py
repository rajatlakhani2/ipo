"""IPO Centre — everything the Open / Upcoming / Past tabs show, for one organisation.

Allotment chance model
----------------------
In an oversubscribed retail (and NII) book, SEBI allots by lottery: every valid
application has the same chance of getting the minimum lot. With subscription S
(times), the chance for one minimum-lot application is roughly 1/S, capped at 100%.
This slightly overstates the chance when many people bid for several lots, so we
label it an estimate. With n independent PANs, the chance that at least one is
allotted is 1 - (1 - p)^n.
"""
import math
from datetime import date, datetime, timedelta

from models import Application, IPO, Investor, UpcomingIPO

CATEGORY_LABELS = {
    'retail': 'Retail',
    'shni': 'Small HNI',
    'bhni': 'Big HNI',
    'nii': 'HNI (NII)',
    'qib': 'QIB',
    'employee': 'Employee',
    'shareholder': 'Shareholder',
    'total': 'Total',
}
CATEGORY_ORDER = ['retail', 'shni', 'bhni', 'nii', 'qib', 'employee', 'shareholder']


# ---------- maths ----------

def chance_one(times):
    """Chance that one minimum-lot application is allotted, 0–1."""
    if times is None or times <= 0:
        return None
    return min(1.0, 1.0 / times)


def chance_any(p, n):
    if p is None or n <= 0:
        return None
    return 1.0 - (1.0 - p) ** n


def pans_needed(p, target=0.5):
    if p is None or p <= 0:
        return None
    if p >= target:
        return 1
    return min(999, math.ceil(math.log(1 - target) / math.log(1 - p)))


def add_working_days(d, n):
    """Weekends skipped; exchange holidays are not known here, so results are 'expected'."""
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


# ---------- helpers ----------

def _key(name):
    from gmp_scraper import normalize_name
    return normalize_name(name)


def _org_applications(org_id):
    """{normalized_ipo_name: set(investor_id)} for live applications."""
    rows = (Application.query.join(IPO, Application.ipo_id == IPO.id)
            .filter(Application.organization_id == org_id)
            .with_entities(IPO.ipo_name, Application.investor_id, Application.status).all())
    out = {}
    for ipo_name, inv_id, status in rows:
        if str(status or '').lower() in ('rejected', 'withdrawn', 'cancelled', 'canceled'):
            continue
        out.setdefault(_key(ipo_name), set()).add(inv_id)
    return out


def _timeline(u, today):
    """Ordered milestones with dates; missing allotment/listing dates are estimated (T+1 / T+3)."""
    close = u.bidding_close
    allot, allot_est = u.allotment_date, False
    listing, listing_est = u.listing_date, False
    if close and not allot:
        allot, allot_est = add_working_days(close, 1), True
    if close and not listing:
        listing, listing_est = add_working_days(close, 3), True
    steps = [
        ('open', 'Opens', u.bidding_open, False),
        ('close', 'Closes', close, False),
        ('allotment', 'Allotment', allot, allot_est),
        ('listing', 'Listing', listing, listing_est),
    ]
    out = []
    for key, label, d, est in steps:
        out.append({
            'key': key, 'label': label,
            'date': d.isoformat() if d else None,
            'estimated': est,
            'done': bool(d and d < today) or (key == 'open' and d is not None and d <= today),
            'today': bool(d and d == today),
        })
    return out


def _stage(u, today):
    """Plain-language stage + the next thing that happens."""
    o, c = u.bidding_open, u.bidding_close
    allot = u.allotment_date or (add_working_days(c, 1) if c else None)
    listing = u.listing_date or (add_working_days(c, 3) if c else None)
    if listing and listing <= today and (u.ipo_status in ('listed', 'closed') or listing < today):
        return 'listed', None, None
    if o and c and o <= today <= c:
        return 'open', 'close', c
    if o and o > today:
        return 'upcoming', 'open', o
    if c and c < today:
        if allot and allot >= today:
            return 'closed', 'allotment', allot
        if listing and listing >= today:
            return 'closed', 'listing', listing
        return 'listed', None, None
    return u.ipo_status or 'upcoming', None, None


def build_ipo_card(u, today, applied_by, active_investors):
    price = u.price_band_high or u.price_band_low
    lot = u.lot_size
    lot_cost = round(price * lot, 2) if price and lot else None
    gmp = u.gmp
    gain_pct = round(gmp / price * 100, 1) if gmp is not None and price else None
    stage, next_event, next_date = _stage(u, today)

    sub = dict(u.subscription or {})
    if 'total' not in sub and u.total_subscription is not None:
        sub['total'] = u.total_subscription
    categories = [{'key': k, 'label': CATEGORY_LABELS[k], 'times': sub[k]} for k in CATEGORY_ORDER if k in sub]
    retail_times = sub.get('retail')
    basis = 'retail'
    if retail_times is None and sub.get('total') is not None:
        retail_times, basis = sub['total'], 'total'

    p = chance_one(retail_times)
    applied = applied_by.get(_key(u.ipo_name), set())
    n_applied = len(applied)

    chance = None
    if p is not None:
        chance = {
            'basis': basis,                       # which subscription figure was used
            'one_pan': round(p * 100, 1),
            'applied_pans': n_applied,
            'applied_any': round(chance_any(p, n_applied) * 100, 1) if n_applied else None,
            'all_active_pans': active_investors,
            'all_active_any': round(chance_any(p, active_investors) * 100, 1) if active_investors else None,
            'pans_for_50': pans_needed(p, 0.5),
            'pans_for_90': pans_needed(p, 0.9),
            'by_category': {c['key']: round(chance_one(c['times']) * 100, 1)
                            for c in categories if c['key'] in ('retail', 'shni', 'bhni', 'nii') and c['times']},
        }

    gain_now = None
    if u.current_price and price:
        gain_now = round((u.current_price - price) / price * 100, 1)
    listing_gain = None
    if u.listing_price and price:
        listing_gain = round((u.listing_price - price) / price * 100, 1)

    return {
        'id': u.id,
        'name': u.ipo_name,
        'type': u.ipo_type or 'Mainboard',
        'exchange': u.exchange,
        'symbol': u.symbol,
        'stage': stage,
        'next_event': next_event,
        'next_date': next_date.isoformat() if next_date else None,
        'price_low': u.price_band_low,
        'price_high': u.price_band_high,
        'lot_size': lot,
        'lot_cost': lot_cost,
        'issue_size': u.issue_size,
        'registrar': u.registrar,
        'gmp': gmp,
        'gmp_pct': gain_pct,
        'gmp_per_lot': round(gmp * lot, 2) if gmp is not None and lot else None,
        'gmp_source': u.gmp_source,
        'gmp_updated_at': u.gmp_updated_at.isoformat() + 'Z' if u.gmp_updated_at else None,
        'subscription': {'categories': categories, 'total': sub.get('total'),
                         'updated_at': u.subscription_updated_at.isoformat() + 'Z' if u.subscription_updated_at else None},
        'chance': chance,
        'applied_pans': n_applied,
        'timeline': _timeline(u, today),
        'listing_price': u.listing_price,
        'listing_gain_pct': listing_gain,
        'current_price': u.current_price,
        'gain_now_pct': gain_now,
        'source_url': u.source_url,
    }


def ipo_centre(org_id, today=None):
    today = today or date.today()
    rows = [u for u in UpcomingIPO.query.filter_by(is_active=True).all()
            if not (u.source == 'manual' and (u.ipo_name or '').startswith('Sample '))]  # old placeholder rows
    applied_by = _org_applications(org_id)
    active = Investor.query.filter_by(organization_id=org_id, is_active=True).count()

    cards = [build_ipo_card(u, today, applied_by, active) for u in rows]
    tabs = {'open': [], 'upcoming': [], 'past': []}
    for c in cards:
        if c['stage'] == 'open':
            tabs['open'].append(c)
        elif c['stage'] == 'upcoming':
            tabs['upcoming'].append(c)
        else:
            tabs['past'].append(c)   # closed (awaiting allotment/listing) + listed

    far = '9999-12-31'
    tabs['open'].sort(key=lambda c: (c['next_date'] or far, -(c['subscription']['total'] or 0)))
    tabs['upcoming'].sort(key=lambda c: c['next_date'] or far)
    # Past: in-progress (closed, awaiting allotment/listing) first, then newest listings
    tabs['past'].sort(key=lambda c: (
        0 if c['stage'] == 'closed' else 1,
        -(datetime.fromisoformat(next((s['date'] for s in reversed(c['timeline']) if s['date']), '1900-01-01')).toordinal()),
    ))

    closing_today = [c['name'] for c in tabs['open'] if c['next_date'] == today.isoformat()]
    opening_today = [c['name'] for c in tabs['open'] if c['timeline'][0]['date'] == today.isoformat()]
    allot_today = [c['name'] for c in tabs['past'] if c['next_event'] == 'allotment' and c['next_date'] == today.isoformat()]
    listing_today = [c['name'] for c in cards if any(s['key'] == 'listing' and s['today'] for s in c['timeline'])]

    last_sync = max((u.last_synced_at for u in rows if u.last_synced_at), default=None)
    gmp_at = max((u.gmp_updated_at for u in rows if u.gmp_updated_at), default=None)
    return {
        'today': today.isoformat(),
        'tabs': tabs,
        'counts': {k: len(v) for k, v in tabs.items()},
        'events_today': {
            'opening': opening_today, 'closing': closing_today,
            'allotment': allot_today, 'listing': listing_today,
        },
        'active_investors': active,
        'last_synced_at': last_sync.isoformat() + 'Z' if last_sync else None,
        'gmp_updated_at': gmp_at.isoformat() + 'Z' if gmp_at else None,
    }
