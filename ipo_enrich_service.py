"""Auto-enrich IPO records with GMP, scores, ratings, and funding requirements."""
from models import Investor, IPO
from gmp_scraper import lookup_gmp, estimate_gmp_from_subscription


def compute_ipo_score(ipo):
    score = 60.0
    price = ipo.purchase_price_per_share or ipo.price_band_high or 0
    if ipo.gmp and price:
        score += min(25, ipo.gmp / price * 50)
    if ipo.subscription_times:
        score += min(15, ipo.subscription_times * 2)
    elif getattr(ipo, 'total_subscription', None):
        score += min(15, (ipo.total_subscription or 0) * 0.5)
    return round(min(99, score), 1)


def enrich_ipo(ipo, organization_id=None, investor_count=None):
    """Fill missing intelligence fields on an IPO row."""
    price = ipo.purchase_price_per_share or ipo.price_band_high or ipo.price_band_low or 0
    lot = ipo.lot_size or ipo.num_shares or 1

    if not ipo.gmp and price:
        live_gmp = lookup_gmp(ipo.ipo_name)
        if live_gmp is not None:
            ipo.gmp = live_gmp
        elif ipo.subscription_times:
            ipo.gmp = estimate_gmp_from_subscription(price, ipo.subscription_times)
        else:
            ipo.gmp = round(price * 0.10, 2)

    if not ipo.subscription_times:
        sub = getattr(ipo, 'total_subscription', None)
        if sub:
            ipo.subscription_times = round(float(sub), 2)

    if organization_id and not ipo.funding_requirement:
        if investor_count is None:
            investor_count = Investor.query.filter_by(
                organization_id=organization_id, is_active=True
            ).count()
        ipo.funding_requirement = round(lot * price * max(investor_count, 1), 2)

    if not ipo.ipo_score:
        ipo.ipo_score = compute_ipo_score(ipo)

    if not ipo.ai_rating:
        ipo.ai_rating = 'A' if ipo.ipo_score > 85 else 'B+' if ipo.ipo_score > 70 else 'B'

    if not ipo.risk_rating:
        ipo.risk_rating = 'Low' if ipo.ipo_score > 80 else 'Medium' if ipo.ipo_score > 65 else 'High'

    if not ipo.expected_listing_gain and ipo.gmp and lot:
        ipo.expected_listing_gain = round(ipo.gmp * lot, 2)

    return ipo
