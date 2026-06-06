"""
Live IPO data fetcher — NSE (primary), Moneycontrol, Chittorgarh, ShareMarketIPO.
"""
import json
import logging
import re
from datetime import datetime, date

import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-IN,en;q=0.9',
}

NSE_IPO_URL = 'https://www.nseindia.com/api/ipo-current-issue'
CHITT_DASHBOARD_URL = 'https://www.chittorgarh.com/ipo/ipo_dashboard.asp'

MONEYCONTROL_PAGES = {
    'open': 'https://www.moneycontrol.com/ipo/open-ipos/',
    'upcoming': 'https://www.moneycontrol.com/ipo/upcoming-ipos/',
    'closed': 'https://www.moneycontrol.com/ipo/closed-ipos/',
    'listed': 'https://www.moneycontrol.com/ipo/listed-ipos/',
}

SOURCE_PRIORITY = {
    'nse': 5,
    'moneycontrol': 4,
    'chittorgarh': 3,
    'sharemarketipo': 1,
    'manual': 0,
}


def _session_get(url, timeout=25, extra_headers=None):
    session = requests.Session()
    session.headers.update(HEADERS)
    if extra_headers:
        session.headers.update(extra_headers)
    if 'moneycontrol.com' in url:
        try:
            session.get('https://www.moneycontrol.com/ipo/', timeout=10)
        except requests.RequestException:
            pass
    return session.get(url, timeout=timeout)


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, str) and re.match(r'^\d{4}-\d{2}-\d{2}', value):
        return datetime.strptime(value[:10], '%Y-%m-%d').date()
    try:
        return date_parser.parse(str(value), dayfirst=True).date()
    except (ValueError, TypeError, OverflowError):
        return None


def _parse_price_band(text):
    if not text:
        return None, None
    text = re.sub(r'[₹Rs.\s]', '', str(text), flags=re.I)
    nums = re.findall(r'[\d.]+', text)
    if not nums:
        return None, None
    vals = [float(n) for n in nums]
    if len(vals) >= 2:
        return min(vals), max(vals)
    return vals[0], vals[0]


def _normalize_ipo_type(raw):
    if not raw:
        return 'Mainboard'
    r = str(raw).lower()
    if 'sme' in r:
        return 'SME'
    return 'Mainboard'


def _clean_name(name):
    if not name:
        return ''
    name = re.sub(r'\s+Limited\s*$', '', name.strip(), flags=re.I)
    name = re.sub(r'\s+Ltd\.?\s*$', '', name.strip(), flags=re.I)
    name = re.sub(r'\s*IPO\s*$', '', name, flags=re.I)
    return name.strip()


def _extract_next_data(html):
    soup = BeautifulSoup(html, 'html.parser')
    tag = soup.find('script', id='__NEXT_DATA__')
    if not tag or not tag.string:
        return None
    try:
        return json.loads(tag.string)
    except json.JSONDecodeError:
        return None


def _ipo_record(**kwargs):
    return {
        'ipo_name': kwargs.get('ipo_name'),
        'ipo_type': kwargs.get('ipo_type', 'Mainboard'),
        'ipo_status': kwargs.get('ipo_status', 'upcoming'),
        'bidding_open': kwargs.get('bidding_open'),
        'bidding_close': kwargs.get('bidding_close'),
        'allotment_date': kwargs.get('allotment_date'),
        'listing_date': kwargs.get('listing_date'),
        'price_band_low': kwargs.get('price_band_low'),
        'price_band_high': kwargs.get('price_band_high'),
        'lot_size': kwargs.get('lot_size'),
        'source': kwargs.get('source'),
        'external_id': kwargs.get('external_id'),
        'source_url': kwargs.get('source_url'),
        'total_subscription': kwargs.get('total_subscription'),
    }


def fetch_nse_ipos():
    """NSE official JSON API — currently open/active mainboard IPOs."""
    results = []
    errors = []
    try:
        resp = _session_get(
            NSE_IPO_URL,
            extra_headers={'Accept': 'application/json', 'Referer': 'https://www.nseindia.com/'},
        )
        resp.raise_for_status()
        items = resp.json()
        if not isinstance(items, list):
            errors.append('nse: unexpected response format')
            return results, errors

        for item in items:
            name = _clean_name(item.get('companyName', ''))
            if not name:
                continue
            band_low, band_high = _parse_price_band(item.get('issuePrice'))
            sub = None
            try:
                if item.get('noOfTime') is not None:
                    sub = round(float(item['noOfTime']), 2)
            except (TypeError, ValueError):
                pass

            results.append(_ipo_record(
                ipo_name=name,
                ipo_type='Mainboard',
                ipo_status='open',
                bidding_open=_parse_date(item.get('issueStartDate')),
                bidding_close=_parse_date(item.get('issueEndDate')),
                price_band_low=band_low,
                price_band_high=band_high,
                source='nse',
                external_id=str(item.get('symbol') or name),
                source_url='https://www.nseindia.com/market-data/issues-ipo',
                total_subscription=sub,
            ))
        logger.info('NSE: %d open IPOs', len(results))
    except Exception as exc:
        logger.exception('NSE fetch failed')
        errors.append(f'nse: {exc}')
    return results, errors


def fetch_chittorgarh_dashboard():
    """Chittorgarh legacy dashboard — open/upcoming IPO list with dates."""
    results = []
    errors = []
    try:
        resp = _session_get(CHITT_DASHBOARD_URL)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        year = date.today().year

        for row in soup.find_all('tr'):
            cell = row.find('td')
            if not cell:
                continue
            link = cell.find('a')
            if not link:
                continue

            name = _clean_name(link.get_text(strip=True))
            if not name or len(name) < 3:
                continue

            href = link.get('href', '')
            source_url = href if href.startswith('http') else f'https://www.chittorgarh.com{href}'
            ext_id = href.strip('/').split('/')[-2] if href else name.lower().replace(' ', '-')
            text = cell.get_text(' ', strip=True)

            ipo_status = 'upcoming'
            if re.search(r'\bO\b', f' {text} ') or ' O ' in text:
                ipo_status = 'open'
            elif re.search(r'\bC[T]?\b', text):
                ipo_status = 'closed'

            open_d = close_d = None
            dm = re.search(r'(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]{3})', text)
            if dm:
                try:
                    open_d = date_parser.parse(f'{dm.group(1)}-{dm.group(3)}-{year}', dayfirst=True).date()
                    close_d = date_parser.parse(f'{dm.group(2)}-{dm.group(3)}-{year}', dayfirst=True).date()
                except (ValueError, OverflowError):
                    pass

            ipo_type = 'SME' if 'sme' in text.lower() else 'Mainboard'
            results.append(_ipo_record(
                ipo_name=name,
                ipo_type=ipo_type,
                ipo_status=ipo_status,
                bidding_open=open_d,
                bidding_close=close_d,
                source='chittorgarh',
                external_id=ext_id,
                source_url=source_url,
            ))

        logger.info('Chittorgarh dashboard: %d IPOs', len(results))
    except Exception as exc:
        logger.exception('Chittorgarh dashboard failed')
        errors.append(f'chittorgarh/dashboard: {exc}')
    return results, errors


def _map_moneycontrol_record(item, status):
    name = _clean_name(item.get('company_name') or item.get('name') or '')
    if not name:
        return None

    band_low = item.get('price_band_low') or item.get('min_price')
    band_high = item.get('price_band_high') or item.get('max_price')
    price = item.get('issue_price') or item.get('price')
    if price and not band_high:
        try:
            band_high = float(price)
            band_low = band_low or band_high
        except (TypeError, ValueError):
            pass
    if item.get('issue_price_range'):
        band_low, band_high = _parse_price_band(item['issue_price_range'])

    lot = item.get('lot_size') or item.get('market_lot')
    try:
        lot = int(lot) if lot is not None else None
    except (TypeError, ValueError):
        lot = None

    ext_id = str(item.get('sc_id') or item.get('company_code') or name)
    slug = item.get('url') or ''
    source_url = f'https://www.moneycontrol.com{slug}' if slug.startswith('/') else slug or None

    return _ipo_record(
        ipo_name=name,
        ipo_type=_normalize_ipo_type(item.get('ipo_type') or item.get('category')),
        ipo_status=status,
        bidding_open=_parse_date(item.get('open_date') or item.get('ipo_open_date')),
        bidding_close=_parse_date(item.get('close_date') or item.get('ipo_close_date')),
        allotment_date=_parse_date(item.get('allotment_date')),
        listing_date=_parse_date(item.get('listing_date')),
        price_band_low=band_low,
        price_band_high=band_high,
        lot_size=lot,
        source='moneycontrol',
        external_id=ext_id,
        source_url=source_url,
        total_subscription=item.get('total_subs'),
    )


def fetch_moneycontrol_ipos():
    """Moneycontrol Next.js pages — may be blocked (403) from some networks."""
    results = []
    errors = []

    for status, url in MONEYCONTROL_PAGES.items():
        try:
            resp = _session_get(url, extra_headers={'Referer': 'https://www.moneycontrol.com/ipo/'})
            if resp.status_code == 403:
                errors.append(f'moneycontrol/{status}: blocked (403)')
                continue
            resp.raise_for_status()
            data = _extract_next_data(resp.text)
            if not data:
                errors.append(f'moneycontrol/{status}: no __NEXT_DATA__')
                continue

            table = data.get('props', {}).get('pageProps', {}).get('ipoTableData', {})
            key_map = {
                'open': ['openData', 'open_ipo_data', 'openIpoData'],
                'upcoming': ['upcomingData', 'upcoming_ipo_data', 'upcomingIpoData', 'forthcomingData'],
                'closed': ['closedData', 'closed_ipo_data', 'closedIpoData'],
                'listed': ['listedData', 'listed_ipo_data', 'listedIpoData'],
            }
            items = []
            for key in key_map.get(status, []):
                if key in table and table[key]:
                    items = table[key]
                    break
            if not items and isinstance(table, dict):
                for key, val in table.items():
                    if isinstance(val, list) and val and status in key.lower():
                        items = val
                        break

            for raw in items or []:
                mapped = _map_moneycontrol_record(raw, status)
                if mapped:
                    results.append(mapped)

            logger.info('Moneycontrol %s: %d IPOs', status, len(items or []))
        except Exception as exc:
            logger.exception('Moneycontrol %s failed', status)
            errors.append(f'moneycontrol/{status}: {exc}')

    return results, errors


def fetch_sharemarketipo_ipos():
    results = []
    errors = []
    url = 'https://www.sharemarketipo.com/'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20, verify=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        for row in soup.select('table tr'):
            cols = row.find_all('td')
            if len(cols) < 2:
                continue
            name = _clean_name(cols[0].get_text(strip=True))
            if not name:
                continue
            band_low, band_high = _parse_price_band(cols[1].get_text(strip=True))
            results.append(_ipo_record(
                ipo_name=name,
                ipo_status='upcoming',
                price_band_low=band_low,
                price_band_high=band_high,
                source='sharemarketipo',
                external_id=name.lower().replace(' ', '-'),
                source_url=url,
            ))
    except Exception as exc:
        errors.append(f'sharemarketipo: {exc}')
    return results, errors


def _merge_ipo(combined, item):
    """Merge by normalized name; higher-priority source wins."""
    key = item['ipo_name'].lower().strip()
    existing = combined.get(key)
    if not existing:
        combined[key] = item
        return
    new_pri = SOURCE_PRIORITY.get(item.get('source'), 0)
    old_pri = SOURCE_PRIORITY.get(existing.get('source'), 0)
    if new_pri >= old_pri:
        merged = {**existing, **{k: v for k, v in item.items() if v is not None}}
        merged['source'] = item['source'] if new_pri > old_pri else existing['source']
        combined[key] = merged
    else:
        for k, v in item.items():
            if existing.get(k) in (None, '', 0) and v not in (None, '', 0):
                existing[k] = v


def fetch_all_live_ipos():
    """Aggregate IPOs from NSE, Moneycontrol, Chittorgarh, ShareMarketIPO."""
    all_errors = []
    combined = {}

    fetchers = (
        fetch_nse_ipos,
        fetch_moneycontrol_ipos,
        fetch_chittorgarh_dashboard,
        fetch_sharemarketipo_ipos,
    )
    for fetcher in fetchers:
        items, errs = fetcher()
        all_errors.extend(errs)
        for item in items:
            _merge_ipo(combined, item)

    ipos = list(combined.values())
    ipos.sort(key=lambda x: (
        0 if x.get('ipo_status') == 'open' else 1 if x.get('ipo_status') == 'upcoming' else 2,
        x.get('bidding_open') or date(9999, 12, 31),
    ))
    return ipos, all_errors
