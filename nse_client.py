"""
NSE India public IPO data.

Endpoints (same ones nseindia.com's own pages call):
  /api/ipo-current-issue                         open + just-closed issues
  /api/all-upcoming-issues?category=ipo          announced, not yet open
  /api/public-past-issues?from_date&to_date      closed / listed (dd-mm-yyyy)
  /api/ipo-detail?symbol=X&series=EQ|SME         issue detail incl. category-wise bids

NSE refuses API calls without the cookies its HTML pages set, so every session
first loads a normal page. Response field names are not documented and vary
between endpoints, so all parsing goes through tolerant key lookup.
"""
import logging
import re
import time
from datetime import date, datetime, timedelta

import requests
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)

BASE = 'https://www.nseindia.com'
API = BASE + '/api'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Referer': BASE + '/market-data/all-upcoming-issues-ipo',
}

_session = None
_session_at = 0


def _get_session(force=False):
    """Session with NSE cookies; refreshed every 10 minutes."""
    global _session, _session_at
    if _session and not force and time.time() - _session_at < 600:
        return _session
    s = requests.Session()
    s.headers.update(HEADERS)
    for warm in ('/market-data/all-upcoming-issues-ipo', '/option-chain', '/'):
        try:
            r = s.get(BASE + warm, timeout=15, headers={'Accept': 'text/html,*/*'})
            if r.status_code == 200 and s.cookies:
                break
        except requests.RequestException:
            continue
    _session, _session_at = s, time.time()
    return s


def nse_get(path, params=None, retries=1):
    """GET an NSE API path → parsed JSON (raises on failure)."""
    last = None
    for attempt in range(retries + 1):
        s = _get_session(force=attempt > 0)
        try:
            r = s.get(API + path, params=params, timeout=20)
            if r.status_code in (401, 403):
                last = RuntimeError(f'NSE {path}: HTTP {r.status_code}')
                continue
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as exc:
            last = exc
    raise last


# ---------- tolerant field helpers ----------

def _norm(k):
    return re.sub(r'[^a-z0-9]', '', str(k).lower())


def pick(d, *names, contains=None):
    """First non-empty value for any of `names` (case/punctuation-insensitive),
    else the first key containing every fragment in `contains`."""
    if not isinstance(d, dict):
        return None
    nd = {_norm(k): v for k, v in d.items()}
    for n in names:
        v = nd.get(_norm(n))
        if v not in (None, '', '-', 'NA', 'N/A'):
            return v
    if contains:
        frags = [_norm(c) for c in contains]
        for k, v in nd.items():
            if all(f in k for f in frags) and v not in (None, '', '-'):
                return v
    return None


def to_float(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r'-?\d[\d,]*\.?\d*', str(v))
    if not m:
        return None
    try:
        return float(m.group(0).replace(',', ''))
    except ValueError:
        return None


def to_date(v):
    if not v or str(v).strip() in ('-', 'NA', 'To be announced', 'TBA'):
        return None
    try:
        return date_parser.parse(str(v), dayfirst=True).date()
    except (ValueError, TypeError, OverflowError):
        return None


def price_band(v):
    nums = [float(n.replace(',', '')) for n in re.findall(r'\d[\d,]*\.?\d*', str(v or ''))]
    nums = [n for n in nums if n > 0]
    if not nums:
        return None, None
    return min(nums), max(nums)


def clean_name(name):
    name = re.sub(r'\s+', ' ', str(name or '')).strip()
    name = re.sub(r'\s*\((?:sme|ipo)\)\s*$', '', name, flags=re.I)
    name = re.sub(r'\s+(limited|ltd\.?)\s*$', '', name, flags=re.I)
    name = re.sub(r'\s+ipo\s*$', '', name, flags=re.I)
    return name.strip()


def _is_sme(item):
    series = str(pick(item, 'series', 'securityType', 'issueType') or '')
    return 'SME' in series.upper() or 'sme' in str(pick(item, 'companyName', 'company') or '').lower()


def _base_record(item, status):
    name = clean_name(pick(item, 'companyName', 'company', 'name', contains=['company']))
    if not name:
        return None
    low, high = price_band(pick(item, 'issuePrice', 'priceBand', 'priceRange', 'price', contains=['price']))
    symbol = pick(item, 'symbol')
    sub = to_float(pick(item, 'noOfTime', 'noOfTimes', 'subscription', contains=['time']))
    return {
        'ipo_name': name,
        'ipo_type': 'SME' if _is_sme(item) else 'Mainboard',
        'ipo_status': status,
        'bidding_open': to_date(pick(item, 'issueStartDate', 'startDate', 'openDate', contains=['start'])),
        'bidding_close': to_date(pick(item, 'issueEndDate', 'endDate', 'closeDate', contains=['end'])),
        'listing_date': to_date(pick(item, 'listingDate', contains=['listing'])),
        'price_band_low': low,
        'price_band_high': high,
        'lot_size': int(to_float(pick(item, 'lotSize', 'marketLot', 'minBidQty', contains=['lot'])) or 0) or None,
        'issue_size': (str(pick(item, 'issueSize', contains=['size'])) or None),
        'total_subscription': round(sub, 2) if sub is not None else None,
        'symbol': str(symbol).upper() if symbol else None,
        'exchange': 'NSE',
        'source': 'nse',
        'external_id': str(symbol or name).upper(),
        'source_url': BASE + '/market-data/all-upcoming-issues-ipo',
    }


def _status_for(rec):
    today = date.today()
    o, c, l = rec.get('bidding_open'), rec.get('bidding_close'), rec.get('listing_date')
    if l and l <= today:
        return 'listed'
    if c and c < today:
        return 'closed'
    if o and o <= today and (not c or c >= today):
        return 'open'
    return 'upcoming'


def _as_list(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ('data', 'dataList', 'records', 'issues'):
            if isinstance(data.get(k), list):
                return data[k]
    return []


def fetch_current():
    out = []
    for item in _as_list(nse_get('/ipo-current-issue')):
        rec = _base_record(item, 'open')
        if rec:
            rec['ipo_status'] = _status_for(rec)
            out.append(rec)
    return out


def fetch_upcoming():
    out = []
    for item in _as_list(nse_get('/all-upcoming-issues', {'category': 'ipo'})):
        rec = _base_record(item, 'upcoming')
        if rec:
            rec['ipo_status'] = _status_for(rec)
            out.append(rec)
    return out


def fetch_past(days=120):
    to = date.today()
    frm = to - timedelta(days=days)
    data = nse_get('/public-past-issues', {
        'from_date': frm.strftime('%d-%m-%Y'), 'to_date': to.strftime('%d-%m-%Y'),
    })
    out = []
    for item in _as_list(data):
        rec = _base_record(item, 'listed')
        if rec:
            rec['ipo_status'] = 'listed' if rec.get('listing_date') and rec['listing_date'] <= to else 'closed'
            out.append(rec)
    return out


# ---------- category-wise subscription ----------

CATEGORY_RULES = [
    # (key, patterns) — checked in order; first match wins
    ('employee', ('employee', 'emp')),
    ('shareholder', ('shareholder',)),
    ('qib', ('qualified', 'qib')),
    ('bhni', ('bnii', 'bhni', 'above 10', 'more than 10', 'above rs 10', 'above rs.10', 'b-nii', 'big')),
    ('shni', ('snii', 'shni', 'upto 10', 'up to 10', '2-10', '2 to 10', 's-nii', 'small')),
    ('nii', ('non institutional', 'non-institutional', 'nii', 'hni')),
    ('retail', ('retail', 'rii', 'individual investor')),
    ('total', ('total',)),
]


def _category_key(label):
    l = str(label or '').lower()
    for key, pats in CATEGORY_RULES:
        if any(p in l for p in pats):
            return key
    return None


def _walk_dict_lists(obj, depth=0):
    """Yield every list of dicts found anywhere in obj."""
    if depth > 5:
        return
    if isinstance(obj, list):
        if obj and all(isinstance(x, dict) for x in obj):
            yield obj
        for x in obj:
            yield from _walk_dict_lists(x, depth + 1)
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _walk_dict_lists(v, depth + 1)


def parse_category_subscription(detail):
    """From an ipo-detail (or ipo-active-category) payload → {'retail': 3.2, 'qib': ...}."""
    result = {}
    for rows in _walk_dict_lists(detail):
        found = {}
        for row in rows:
            label = pick(row, 'category', 'categoryName', 'investorCategory', contains=['categ'])
            key = _category_key(label)
            if not key:
                continue
            times = to_float(pick(row, 'noOfTotalMeant', 'noOfTime', 'noOfTimes', 'subscription',
                                  'timesSubscribed', contains=['time']))
            if times is None:
                offered = to_float(pick(row, 'noOfShareOffered', 'noOfSharesOffered', 'sharesOffered', contains=['offer']))
                bid = to_float(pick(row, 'noOfSharesBid', 'noOfShareBid', 'sharesBid', contains=['bid']))
                if offered and bid is not None:
                    times = bid / offered
            if times is not None and key not in found:
                found[key] = round(times, 2)
        if len(found) >= 2:   # a real category table, not a stray list
            result = found
            break
    return result


def parse_detail_extras(detail):
    """Lot size, registrar, dates that the list endpoints sometimes omit."""
    extras = {}
    flat = {}
    for rows in _walk_dict_lists(detail):
        for row in rows:
            title = pick(row, 'title', 'label', 'key', 'name')
            value = pick(row, 'value', 'data', 'details')
            if title and value is not None:
                flat[_norm(title)] = value
    if isinstance(detail, dict):
        for k, v in detail.items():
            if not isinstance(v, (dict, list)):
                flat[_norm(k)] = v
    for k, v in flat.items():
        if 'registrar' in k and 'registrar' not in extras:
            extras['registrar'] = re.sub(r'\s+', ' ', str(v)).strip()[:100]
        elif ('lotsize' in k or 'marketlot' in k or 'minimumbid' in k or 'minbid' in k) and 'lot_size' not in extras:
            n = to_float(v)
            if n:
                extras['lot_size'] = int(n)
        elif 'allotment' in k and 'date' in k and 'allotment_date' not in extras:
            d = to_date(v)
            if d:
                extras['allotment_date'] = d
        elif 'listing' in k and 'date' in k and 'listing_date' not in extras:
            d = to_date(v)
            if d:
                extras['listing_date'] = d
    return extras


def fetch_detail(symbol, ipo_type='Mainboard'):
    series = 'SME' if ipo_type == 'SME' else 'EQ'
    detail = nse_get('/ipo-detail', {'symbol': symbol, 'series': series})
    return parse_category_subscription(detail), parse_detail_extras(detail)


def fetch_quote(symbol):
    """→ (last_price, open_price) for a listed symbol."""
    q = nse_get('/quote-equity', {'symbol': symbol})
    info = q.get('priceInfo', {}) if isinstance(q, dict) else {}
    return to_float(pick(info, 'lastPrice', 'close')), to_float(pick(info, 'open'))


def fetch_all(include_past=True):
    """→ (records, errors). Each fetch is independent so one failure doesn't stop the rest."""
    records, errors = [], []
    jobs = [('current', fetch_current), ('upcoming', fetch_upcoming)]
    if include_past:
        jobs.append(('past', fetch_past))
    for label, fn in jobs:
        try:
            got = fn()
            records.extend(got)
            logger.info('NSE %s: %d', label, len(got))
        except Exception as exc:
            errors.append(f'nse/{label}: {exc}')
    return records, errors
