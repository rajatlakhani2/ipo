"""End-to-end test of the real Flask app on a throwaway SQLite DB.

Run: python3 tests/test_e2e.py   (needs the packages in requirements.txt)
"""
import os, sys, tempfile, types, json
from datetime import date, datetime, timedelta
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = os.environ.get('LIBSRC')  # optional: folder with sqlalchemy / flask-sqlalchemy / flask-cors source checkouts
if L:
    sys.path[:0] = [f'{L}/sqlalchemy/lib', f'{L}/flask-sqlalchemy/src', f'{L}/flask-cors']
sys.path.insert(0, ROOT)
sys.modules.setdefault('stripe', types.SimpleNamespace(api_key=None))  # billing not under test
tmp = tempfile.mkdtemp()
os.environ.update(DATABASE_URL=f'sqlite:///{tmp}/t.sqlite', DISABLE_BACKGROUND_JOBS='true', CRON_KEY='k' * 32, SECRET_KEY='test')
os.chdir(ROOT)
from app import create_app
from extensions import db
app = create_app(); c = app.test_client()
FAILS = []
def check(label, ok, extra=''):
    print(('  ok   ' if ok else '  FAIL '), label, '' if ok else extra)
    if not ok: FAILS.append(label)

def reg(email):
    r = c.post('/api/auth/register', json={'email': email, 'password': 'secret123', 'full_name': 'Rajat Lakhani', 'organization_name': 'Lakhani Family'})
    return {'Authorization': 'Bearer ' + r.get_json()['token']}
H = reg('rajat@example.com'); H2 = reg('other@example.com')

print('Investors: PAN / Demat validation')
r = c.post('/api/fo/investors', headers=H, json={'name': 'RAJAT', 'pan': 'aklpl1234k', 'demat_account': '1208160012345678'})
check('create ok + PAN uppercased', r.status_code == 201 and r.get_json()['pan'] == 'AKLPL1234K', r.data[:200])
a = r.get_json()['id']
check('bad PAN rejected', c.post('/api/fo/investors', headers=H, json={'name': 'X', 'pan': 'ABCD1234F'}).status_code == 400)
check('17-digit demat rejected', c.post('/api/fo/investors', headers=H, json={'name': 'X', 'demat_account': '12081600123456789'}).status_code == 400)
b = c.post('/api/fo/investors', headers=H, json={'name': 'RAJAT L (DUPLICATE ENTRY)', 'pan': 'AKLPL1234K'}).get_json()['id']
d = c.post('/api/fo/investors', headers=H, json={'name': 'PRIYA', 'pan': 'BQRPL5678M', 'demat_account': '1208160012345678'}).get_json()['id']
e = c.post('/api/fo/investors', headers=H, json={'name': 'MAHESH', 'pan': 'CXZPL4433A'}).get_json()['id']

print('Applications: one PAN per IPO')
with app.app_context():
    from models import IPO, UpcomingIPO, Investor
    org = Investor.query.get(a).organization_id
    ipo = IPO(organization_id=org, ipo_name='ACME SOLAR HOLDINGS', status='Open', lifecycle_stage='Open', ipo_date=date.today() - timedelta(days=1),
              bidding_close_date=date.today() + timedelta(days=1), lot_size=51, num_shares=51, purchase_price_per_share=289)
    db.session.add(ipo); db.session.commit(); ipo_id = ipo.id
r = c.post('/api/applications', headers=H, json={'ipo_id': ipo_id, 'investor_id': a, 'application_amount': 14739})
check('first application ok', r.status_code == 201, r.data[:200])
r = c.post('/api/applications', headers=H, json={'ipo_id': ipo_id, 'investor_id': b})
check('same PAN under another entry blocked', r.status_code == 409 and 'AKLPL1234K' in r.get_json()['error'], r.data[:200])
r = c.post('/api/applications', headers=H, json={'ipo_id': ipo_id, 'investor_id': d})
check('same Demat under another entry blocked', r.status_code == 409 and 'Demat' in r.get_json()['error'], r.data[:200])
check('different PAN ok', c.post('/api/applications', headers=H, json={'ipo_id': ipo_id, 'investor_id': e}).status_code == 201)

print('Account isolation')
r = c.post('/api/fo/allocation/execute', headers=H2, json={'ipo_id': ipo_id, 'investor_ids': [a]})
check("other account can't apply my investor", r.status_code in (400, 403, 404) or r.get_json().get('created', 0) == 0, r.data[:200])

print('Demo seeding')
r = c.post('/api/fo/seed-demo', headers=H, json={})
check('refused on account with data', r.status_code == 409)
with app.app_context():
    check('real PAN untouched', Investor.query.get(a).pan == 'AKLPL1234K')

print('IPO Centre API')
with app.app_context():
    t = date.today()
    db.session.add(UpcomingIPO(ipo_name='Acme Solar Holdings', ipo_status='open', bidding_open=t - timedelta(days=1), bidding_close=t + timedelta(days=1),
                               price_band_low=275, price_band_high=289, lot_size=51, source='nse', external_id='ACMESOL', symbol='ACMESOL',
                               gmp=22, subscription_json=json.dumps({'retail': 2.25, 'qib': 5.5, 'total': 3.41}), last_synced_at=datetime.utcnow()))
    db.session.add(UpcomingIPO(ipo_name='Kaveri Fintech', ipo_type='SME', ipo_status='upcoming', bidding_open=t + timedelta(days=6),
                               bidding_close=t + timedelta(days=8), source='nse', external_id='KAVERI', last_synced_at=datetime.utcnow()))
    db.session.commit()
r = c.get('/api/fo/ipo-centre', headers=H); j = r.get_json()
check('ipo-centre 200', r.status_code == 200, r.data[:300])
check('tabs split', j and j['counts']['open'] == 1 and j['counts']['upcoming'] == 1, j and j['counts'])
card = j['tabs']['open'][0]
check('my 2 applied PANs counted', card['applied_pans'] == 2, card['applied_pans'])
check('chance computed', card['chance']['one_pan'] == 44.4 and card['chance']['applied_any'] == round((1 - (1 - 1/2.25)**2) * 100, 1), card['chance'])
check('other account sees 0 applied', c.get('/api/fo/ipo-centre', headers=H2).get_json()['tabs']['open'][0]['applied_pans'] == 0)
check('needs login', c.get('/api/fo/ipo-centre').status_code == 401)

print('Cron + file safety')
check('cron wrong key 403', c.get('/api/cron/sync?key=nope').status_code == 403)
for path in ['/data/t.sqlite', '/.env', '/app.py', '/config.py', '/.git/config', '/requirements.txt', '/..%2f..%2fetc/passwd']:
    check(f'blocked {path}', c.get(path).status_code == 404)
for path in ['/', '/login.html', '/ipo-centre.js', '/home.css', '/theme.css', '/manifest.webmanifest', '/sw.js', '/offline.html', '/icons/icon-192.png']:
    check(f'served {path}', c.get(path).status_code == 200)
check('manifest content type', 'manifest' in c.get('/manifest.webmanifest').content_type)

print('\nALL PASSED' if not FAILS else f'\n{len(FAILS)} FAILED: {FAILS}')
sys.exit(1 if FAILS else 0)
