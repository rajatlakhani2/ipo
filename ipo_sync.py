import json
import logging
from datetime import date, datetime, timedelta

from extensions import db
from models import UpcomingIPO
from ipo_scraper import fetch_all_live_ipos

logger = logging.getLogger(__name__)

MODEL_FIELDS = {
    'ipo_name', 'ipo_type', 'ipo_status', 'bidding_open', 'bidding_close',
    'allotment_date', 'listing_date', 'price_band_low', 'price_band_high',
    'lot_size', 'source', 'external_id', 'source_url', 'total_subscription',
    'symbol', 'exchange', 'issue_size', 'registrar',
}
# Fields a lower-quality later fetch must not blank out
KEEP_IF_MISSING = {'lot_size', 'allotment_date', 'listing_date', 'price_band_low', 'price_band_high',
                   'symbol', 'issue_size', 'registrar', 'total_subscription', 'bidding_open', 'bidding_close'}


def _find_row(item, ext):
    from gmp_scraper import normalize_name
    row = UpcomingIPO.query.filter_by(source=item.get('source', 'unknown'), external_id=ext).first()
    if row:
        return row
    key = normalize_name(item['ipo_name'])
    if item.get('symbol'):
        row = UpcomingIPO.query.filter_by(symbol=item['symbol']).first()
        if row:
            return row
    for cand in UpcomingIPO.query.filter(UpcomingIPO.ipo_name.ilike(f"%{item['ipo_name'].split()[0]}%")).all():
        if normalize_name(cand.ipo_name) == key:
            return cand
    return None


def _refresh_gmp(rows, now):
    from gmp_scraper import fetch_gmp_table, lookup_gmp
    gmp_map, errors = fetch_gmp_table()
    found = 0
    if not gmp_map:
        return found, errors
    for row in rows:
        if row.ipo_status not in ('open', 'upcoming', 'closed'):
            continue
        gmp, src = lookup_gmp(row.ipo_name, gmp_map)
        if gmp is not None:
            row.gmp, row.gmp_source, row.gmp_updated_at = gmp, src, now
            found += 1
    return found, errors


def _refresh_categories(rows, now):
    """Category-wise subscription from NSE for open + recently closed issues."""
    import nse_client
    errors, done = [], 0
    recent = date.today() - timedelta(days=4)
    for row in rows:
        if not row.symbol or row.source != 'nse':
            continue
        if row.ipo_status == 'upcoming' or (row.bidding_close and row.bidding_close < recent):
            continue
        try:
            cats, extras = nse_client.fetch_detail(row.symbol, row.ipo_type)
        except Exception as exc:
            errors.append(f'nse/detail {row.symbol}: {exc}')
            continue
        if cats:
            if 'total' not in cats and row.total_subscription:
                cats['total'] = row.total_subscription
            row.subscription_json = json.dumps(cats)
            row.subscription_updated_at = now
            if cats.get('total'):
                row.total_subscription = cats['total']
            done += 1
        for k, v in extras.items():
            if getattr(row, k, None) in (None, '', 0):
                setattr(row, k, v)
    return done, errors


def _refresh_prices(rows, now, limit=30):
    """Current price for issues listed in the last 60 days; listing-day open as listing price."""
    import nse_client
    errors, done = [], 0
    cutoff = date.today() - timedelta(days=60)
    listed = [r for r in rows if r.symbol and r.listing_date and cutoff <= r.listing_date <= date.today()]
    listed.sort(key=lambda r: r.listing_date, reverse=True)
    for row in listed[:limit]:
        try:
            last, opn = nse_client.fetch_quote(row.symbol)
        except Exception as exc:
            errors.append(f'nse/quote {row.symbol}: {exc}')
            continue
        if last:
            row.current_price = last
            done += 1
        if opn and not row.listing_price and row.listing_date == date.today():
            row.listing_price = opn
        if row.ipo_status != 'listed':
            row.ipo_status = 'listed'
    return done, errors


def sync_live_ipos(with_details=True):
    """Fetch from external sites and upsert into upcoming_ipos table."""
    items, errors = fetch_all_live_ipos()
    now = datetime.utcnow()
    created = updated = 0
    touched = []

    for item in items:
        ext = item.get('external_id') or item['ipo_name'].lower().replace(' ', '-')
        row = _find_row(item, ext)
        payload = {k: item[k] for k in MODEL_FIELDS if k in item}
        payload['external_id'] = ext
        payload['is_active'] = True
        payload['last_synced_at'] = now

        if row:
            for k, v in payload.items():
                if v in (None, '') and k in KEEP_IF_MISSING:
                    continue
                setattr(row, k, v)
            updated += 1
        else:
            row = UpcomingIPO(**payload)
            db.session.add(row)
            created += 1
        touched.append(row)

    if items:
        UpcomingIPO.query.filter(
            UpcomingIPO.source == 'manual',
            UpcomingIPO.ipo_name.like('Sample%'),
        ).update({'is_active': False}, synchronize_session=False)
    db.session.flush()

    gmp_found = cats_found = 0
    if with_details:
        all_rows = UpcomingIPO.query.filter_by(is_active=True).all()
        gmp_found, gmp_err = _refresh_gmp(all_rows, now)
        cats_found, cat_err = _refresh_categories(all_rows, now)
        _prices, price_err = _refresh_prices(all_rows, now)
        errors += gmp_err + cat_err + price_err

    db.session.commit()
    return {
        'fetched': len(items),
        'created': created,
        'updated': updated,
        'gmp_found': gmp_found,
        'category_subscriptions': cats_found,
        'errors': errors,
        'synced_at': now.isoformat(),
    }
