from datetime import datetime

from extensions import db
from models import UpcomingIPO
from ipo_scraper import fetch_all_live_ipos

MODEL_FIELDS = {
    'ipo_name', 'ipo_type', 'ipo_status', 'bidding_open', 'bidding_close',
    'allotment_date', 'listing_date', 'price_band_low', 'price_band_high',
    'lot_size', 'source', 'external_id', 'source_url', 'total_subscription',
}


def sync_live_ipos():
    """Fetch from external sites and upsert into upcoming_ipos table."""
    items, errors = fetch_all_live_ipos()
    now = datetime.utcnow()
    created = updated = 0

    for item in items:
        src = item.get('source', 'unknown')
        ext = item.get('external_id') or item['ipo_name'].lower().replace(' ', '-')
        row = UpcomingIPO.query.filter_by(source=src, external_id=ext).first()
        if not row:
            row = UpcomingIPO.query.filter(
                db.func.lower(UpcomingIPO.ipo_name) == item['ipo_name'].lower().strip()
            ).first()

        payload = {k: item[k] for k in MODEL_FIELDS if k in item}
        payload['external_id'] = ext
        payload['is_active'] = True
        payload['last_synced_at'] = now

        if row:
            for k, v in payload.items():
                setattr(row, k, v)
            updated += 1
        else:
            db.session.add(UpcomingIPO(**payload))
            created += 1

    # Deactivate manual sample rows when live data exists
    if items:
        UpcomingIPO.query.filter(
            UpcomingIPO.source == 'manual',
            UpcomingIPO.ipo_name.like('Sample%'),
        ).update({'is_active': False})

    db.session.commit()
    return {
        'fetched': len(items),
        'created': created,
        'updated': updated,
        'errors': errors,
        'synced_at': now.isoformat(),
    }
