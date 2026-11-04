"""Offline tests for IPO Centre parsers and maths: python3 tests/test_ipo_centre.py"""
import os
import sys
import types
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# ipo_centre_service imports models (needs a DB); stub it for the pure-function tests
sys.modules.setdefault('models', types.SimpleNamespace(Application=None, IPO=None, Investor=None, UpcomingIPO=None))

import nse_client as n           # noqa: E402
import gmp_scraper as gm         # noqa: E402
import ipo_centre_service as c   # noqa: E402

FAILS = []


def check(label, got, want):
    ok = got == want
    print(('  ok   ' if ok else '  FAIL '), label, '' if ok else f'-> got {got!r}, want {want!r}')
    if not ok:
        FAILS.append(label)


print('NSE list record')
item = {'symbol': 'ACMESOL', 'companyName': 'Acme Solar Holdings Limited', 'series': 'EQ',
        'issueStartDate': '04-Nov-2026', 'issueEndDate': '06-Nov-2026', 'issuePrice': 'Rs.275 to Rs.289',
        'issueSize': '2900 Cr', 'noOfTime': '3.41', 'lotSize': '51'}
r = n._base_record(item, 'open')
check('name cleaned', r['ipo_name'], 'Acme Solar Holdings')
check('price band', (r['price_band_low'], r['price_band_high']), (275.0, 289.0))
check('dates', (r['bidding_open'], r['bidding_close']), (date(2026, 11, 4), date(2026, 11, 6)))
check('lot', r['lot_size'], 51)
check('subscription', r['total_subscription'], 3.41)
check('mainboard', r['ipo_type'], 'Mainboard')
sme = n._base_record({'symbol': 'TINY', 'companyName': 'Tiny Tools Ltd', 'series': 'SME', 'issuePrice': '95'}, 'open')
check('sme detected', sme['ipo_type'], 'SME')

print('NSE category subscription')
detail = {'bidDetails': {'dataList': [
    {'srNo': '1', 'category': 'Qualified Institutional Buyers(QIBs)', 'noOfShareOffered': '1,000', 'noOfSharesBid': '5,500'},
    {'srNo': '2', 'category': 'Non Institutional Investors', 'noOfTotalMeant': '7.20'},
    {'srNo': '2(a)', 'category': 'bNII (bids above Rs 10 lakhs)', 'noOfTotalMeant': '8.10'},
    {'srNo': '2(b)', 'category': 'sNII (bids between Rs 2 to 10 lakhs)', 'noOfTotalMeant': '5.40'},
    {'srNo': '3', 'category': 'Retail Individual Investors(RIIs)', 'noOfTotalMeant': '2.25'},
    {'srNo': '4', 'category': 'Employees', 'noOfTotalMeant': '1.10'},
    {'srNo': '5', 'category': 'Total', 'noOfTotalMeant': '3.41'},
]}, 'issueInfo': {'dataList': [
    {'title': 'Name of the Registrar', 'value': 'KFin Technologies Limited'},
    {'title': 'Minimum Bid Quantity', 'value': '51 Equity Shares'},
]}}
cats = n.parse_category_subscription(detail)
check('qib from shares', cats.get('qib'), 5.5)
check('nii', cats.get('nii'), 7.2)
check('bhni', cats.get('bhni'), 8.1)
check('shni', cats.get('shni'), 5.4)
check('retail', cats.get('retail'), 2.25)
check('employee', cats.get('employee'), 1.1)
check('total', cats.get('total'), 3.41)
ex = n.parse_detail_extras(detail)
check('registrar', ex.get('registrar'), 'KFin Technologies Limited')
check('lot from detail', ex.get('lot_size'), 51)
check('stray list ignored', n.parse_category_subscription({'x': [{'category': 'Retail', 'noOfTime': 2}]}), {})

print('GMP parsing')
for text, want in [('₹22 (18.3%)', 22.0), ('₹-5', -5.0), ('-₹5', -5.0), ('--', None), ('NA', None),
                   ('₹0', 0.0), ('Rs. 1,250', 1250.0), ('', None), ('−8', -8.0)]:
    check(f'gmp {text!r}', gm.parse_gmp_value(text), want)
html = '''<table><thead><tr><th>IPO Name</th><th>Price</th><th>IPO GMP</th><th>Updated</th></tr></thead><tbody>
<tr><td>Acme Solar Holdings Ltd IPO</td><td>289</td><td>₹22 (7.6%)</td><td>05-Nov</td></tr>
<tr><td>Tiny Tools SME IPO</td><td>95</td><td>₹-3</td><td>05-Nov</td></tr>
<tr><td>No Grey Ltd</td><td>100</td><td>-</td><td>05-Nov</td></tr></tbody></table>
<table><tr><th>Date</th><th>Event</th></tr><tr><td>1</td><td>x</td></tr></table>'''
rows = gm.parse_gmp_html(html)
check('gmp rows found', sorted(rows), ['acme solar holdings', 'tiny tools'])
gmap = {k: (v[1], 'test') for k, v in rows.items()}
check('lookup exact', gm.lookup_gmp('Acme Solar Holdings Limited', gmap), (22.0, 'test'))
check('lookup prefix', gm.lookup_gmp('Acme Solar', gmap), (22.0, 'test'))
check('lookup no false match', gm.lookup_gmp('Acme Pharma', gmap), (None, None))
check('lookup sme', gm.lookup_gmp('Tiny Tools', gmap), (-3.0, 'test'))

print('Allotment chance maths')
check('1/S', round(c.chance_one(4), 4), 0.25)
check('undersubscribed = 100%', c.chance_one(0.8), 1.0)
check('no data', c.chance_one(None), None)
check('any of 4 at 25%', round(c.chance_any(0.25, 4), 4), round(1 - 0.75 ** 4, 4))
check('pans for 50% at 10%', c.pans_needed(0.10), 7)
check('pans for 50% at 60%', c.pans_needed(0.6), 1)
check('working days skip weekend', c.add_working_days(date(2026, 11, 6), 1), date(2026, 11, 9))  # Fri -> Mon


class U:  # minimal UpcomingIPO stand-in
    def __init__(self, **kw):
        defaults = dict(id=1, ipo_name='Acme Solar Holdings', ipo_type='Mainboard', exchange='NSE', symbol='ACMESOL',
                        ipo_status='open', bidding_open=date(2026, 11, 4), bidding_close=date(2026, 11, 6),
                        allotment_date=None, listing_date=None, price_band_low=275.0, price_band_high=289.0,
                        lot_size=51, issue_size='2900 Cr', registrar='KFin', gmp=22.0, gmp_source='ipowatch',
                        gmp_updated_at=datetime(2026, 11, 5, 4, 0), subscription={'retail': 2.25, 'qib': 5.5, 'total': 3.41},
                        total_subscription=3.41, subscription_updated_at=datetime(2026, 11, 5, 4, 0),
                        listing_price=None, current_price=None, source_url=None, last_synced_at=None)
        defaults.update(kw)
        self.__dict__.update(defaults)


today = date(2026, 11, 5)
card = c.build_ipo_card(U(), today, {'acme solar holdings': {1, 2, 3}}, 8)
check('stage open', card['stage'], 'open')
check('next is close', (card['next_event'], card['next_date']), ('close', '2026-11-06'))
check('lot cost', card['lot_cost'], 14739.0)
check('gmp pct', card['gmp_pct'], 7.6)
check('gmp per lot', card['gmp_per_lot'], 1122.0)
check('one pan chance', card['chance']['one_pan'], 44.4)
check('3 applied pans', card['chance']['applied_any'], round((1 - (1 - 1 / 2.25) ** 3) * 100, 1))
check('estimated allotment', [s['estimated'] for s in card['timeline']], [False, False, True, True])
check('allotment date', card['timeline'][2]['date'], '2026-11-09')
check('listing T+3', card['timeline'][3]['date'], '2026-11-11')
up = c.build_ipo_card(U(bidding_open=date(2026, 11, 10), bidding_close=date(2026, 11, 12), subscription={},
                        total_subscription=None, gmp=None), today, {}, 8)
check('upcoming stage', up['stage'], 'upcoming')
check('no chance before bidding', up['chance'], None)
check('no gmp shown as None', up['gmp_pct'], None)
closed = c.build_ipo_card(U(bidding_open=date(2026, 10, 30), bidding_close=date(2026, 11, 3)), today, {}, 8)
check('closed awaiting listing', (closed['stage'], closed['next_event']), ('closed', 'listing'))
listed = c.build_ipo_card(U(bidding_open=date(2026, 10, 1), bidding_close=date(2026, 10, 3), listing_date=date(2026, 10, 8),
                            listing_price=340.0, current_price=310.0), today, {}, 8)
check('listed stage', listed['stage'], 'listed')
check('listing gain', listed['listing_gain_pct'], 17.6)
check('gain now', listed['gain_now_pct'], 7.3)

print()
print('ALL PASSED' if not FAILS else f'{len(FAILS)} FAILED: {FAILS}')
sys.exit(1 if FAILS else 0)
