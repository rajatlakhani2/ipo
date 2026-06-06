"""Fetch Grey Market Premium (GMP) from public IPO trackers."""
import logging
import re

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
}

GMP_URLS = [
    'https://www.investorgain.com/report/live-ipo-gmp/310/ipo-gmp/',
    'https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/ipo-gmp/310/',
]


def _clean_name(name):
    if not name:
        return ''
    name = re.sub(r'\s+Limited\s*$', '', name.strip(), flags=re.I)
    name = re.sub(r'\s+Ltd\.?\s*$', '', name.strip(), flags=re.I)
    return name.strip().lower()


def fetch_gmp_table():
    """Return {normalized_name: gmp_float}."""
    gmp_map = {}
    for url in GMP_URLS:
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, 'html.parser')
            for row in soup.find_all('tr'):
                cells = row.find_all('td')
                if len(cells) < 3:
                    continue
                name = _clean_name(cells[0].get_text(strip=True))
                if not name or len(name) < 3:
                    continue
                gmp_text = cells[1].get_text(strip=True) if len(cells) > 1 else ''
                nums = re.findall(r'[\d.]+', gmp_text.replace(',', ''))
                if nums:
                    try:
                        gmp_map[name] = float(nums[0])
                    except ValueError:
                        pass
            if gmp_map:
                logger.info('GMP scraped: %d entries from %s', len(gmp_map), url)
                break
        except Exception as exc:
            logger.warning('GMP fetch failed %s: %s', url, exc)
    return gmp_map


def lookup_gmp(ipo_name, gmp_map=None):
    if gmp_map is None:
        gmp_map = fetch_gmp_table()
    key = _clean_name(ipo_name)
    if key in gmp_map:
        return gmp_map[key]
    for k, v in gmp_map.items():
        if key in k or k in key:
            return v
    return None


def estimate_gmp_from_subscription(price, subscription_times):
    if not price:
        return None
    sub = subscription_times or 0
    if sub >= 100:
        return round(price * 0.35, 2)
    if sub >= 50:
        return round(price * 0.25, 2)
    if sub >= 20:
        return round(price * 0.18, 2)
    if sub >= 5:
        return round(price * 0.12, 2)
    return round(price * 0.08, 2)
