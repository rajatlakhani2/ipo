"""Grey Market Premium (GMP) from public IPO trackers.

GMP is unofficial: it comes from informal grey-market dealers and is reported
by tracker sites. We only ever store values actually published by a source —
never an estimate — so the UI can show "Not available" honestly.
"""
import logging
import re

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Accept-Language': 'en-IN,en;q=0.9',
}

# Tried in order; results are merged, earlier sources win on conflicts.
GMP_SOURCES = [
    ('ipowatch', 'https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/'),
    ('investorgain', 'https://www.investorgain.com/report/live-ipo-gmp/331/'),
    ('chittorgarh', 'https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/ipo-gmp/310/'),
]


def normalize_name(name):
    """Comparable key: lowercase, no Ltd/Limited/IPO/SME/punctuation."""
    n = str(name or '').lower()
    n = re.sub(r'\(.*?\)', ' ', n)
    n = re.sub(r'\b(limited|ltd|ipo|sme|nse|bse|mainboard|india|pvt|private)\b', ' ', n)
    n = re.sub(r'[^a-z0-9]+', ' ', n)
    return re.sub(r'\s+', ' ', n).strip()


def parse_gmp_value(text):
    """'₹22 (18.3%)' → 22.0 ; '₹-5' → -5.0 ; '-', '--', 'NA' → None."""
    t = str(text or '').replace(',', '').replace('−', '-').strip()
    if not t or re.fullmatch(r'[-–—\s]*|na|n/a|nil', t, flags=re.I):
        return None
    m = re.search(r'(-?)\s*(?:₹|rs\.?|inr)?\s*(-?\d+(?:\.\d+)?)', t, flags=re.I)
    if not m:
        return None
    val = float(m.group(2))
    if m.group(1) == '-' and val > 0:
        val = -val
    return val


def _header_index(headers, *frags, avoid=()):
    for i, h in enumerate(headers):
        hl = h.lower()
        if any(f in hl for f in frags) and not any(a in hl for a in avoid):
            return i
    return None


def parse_gmp_html(html):
    """Return {normalized_name: (display_name, gmp)} from every table that has a GMP column."""
    soup = BeautifulSoup(html, 'html.parser')
    out = {}
    for table in soup.find_all('table'):
        head_row = table.find('thead') or table.find('tr')
        if not head_row:
            continue
        headers = [c.get_text(' ', strip=True) for c in head_row.find_all(['th', 'td'])]
        gi = _header_index(headers, 'gmp', 'premium', avoid=('updated', 'date', 'last'))
        if gi is None:
            continue
        ni = _header_index(headers, 'ipo', 'name', 'company', avoid=('gmp', 'price', 'date', 'size', 'type'))
        ni = 0 if ni is None else ni
        body_rows = table.find('tbody').find_all('tr') if table.find('tbody') else table.find_all('tr')[1:]
        for row in body_rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) <= max(gi, ni):
                continue
            name = cells[ni].get_text(' ', strip=True)
            key = normalize_name(name)
            if len(key) < 3:
                continue
            gmp = parse_gmp_value(cells[gi].get_text(' ', strip=True))
            if gmp is not None and key not in out:
                out[key] = (name, gmp)
    return out


def fetch_gmp_table():
    """→ ({normalized_name: (gmp, source)}, errors)."""
    merged, errors = {}, []
    for label, url in GMP_SOURCES:
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                errors.append(f'gmp/{label}: HTTP {r.status_code}')
                continue
            rows = parse_gmp_html(r.text)
            if not rows:
                errors.append(f'gmp/{label}: no GMP table found')
                continue
            for key, (_name, gmp) in rows.items():
                merged.setdefault(key, (gmp, label))
            logger.info('GMP %s: %d rows', label, len(rows))
        except Exception as exc:
            errors.append(f'gmp/{label}: {exc}')
    return merged, errors


def lookup_gmp(ipo_name, gmp_map=None):
    """→ (gmp, source) or (None, None). Exact name match first, then whole-word containment."""
    if gmp_map is None:
        gmp_map, _ = fetch_gmp_table()
    key = normalize_name(ipo_name)
    if not key:
        return None, None
    if key in gmp_map:
        return gmp_map[key]
    first = key.split()[0] if key.split() else key
    for k, v in gmp_map.items():
        # 'acme solar' vs 'acme solar holdings' — require the shorter to be a whole-word prefix
        short, long_ = (k, key) if len(k) < len(key) else (key, k)
        if len(short) >= 5 and (long_ + ' ').startswith(short + ' ') and k.split()[0] == first:
            return v
    return None, None
