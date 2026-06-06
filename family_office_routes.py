"""Family Office Dashboard API — all phase endpoints."""
from datetime import date, datetime, timedelta

from flask import Blueprint, g, jsonify, request

from auth_utils import require_auth, require_write
from extensions import db
from models import (
    AIRecommendation, Application, BankAccount, BankInvestorLink,
    BrokerConnection, Holding, IPO, Investor, InvestorContact,
    Transfer, WealthAsset,
)
from treasury_service import (
    get_net_worth, get_transfer_settlement, get_treasury_summary, refresh_bank_blocked,
)
from allocation_service import optimize_allocation, execute_allocation
from advisor_service import advise
from market_service import get_market_pulse, refresh_holdings_prices
from registrar_service import registrar_info, list_registrars
from ipo_enrich_service import enrich_ipo, compute_ipo_score as _compute_ipo_score

fo_bp = Blueprint('family_office', __name__, url_prefix='/api/fo')


# ---------- Home & Treasury ----------

@fo_bp.route('/home', methods=['GET'])
@require_auth()
def home_dashboard():
    org_id = g.organization_id
    refresh_bank_blocked(org_id)
    nw = get_net_worth(org_id)
    treasury = get_treasury_summary(org_id)
    market = get_market_pulse(org_id)
    recs = AIRecommendation.query.filter_by(
        organization_id=org_id, is_dismissed=False
    ).order_by(AIRecommendation.created_at.desc()).limit(5).all()
    if not recs:
        _seed_recommendations(org_id, treasury, nw)
        recs = AIRecommendation.query.filter_by(organization_id=org_id, is_dismissed=False).limit(5).all()
    return jsonify({
        'net_worth': nw,
        'treasury': treasury,
        'market_pulse': market,
        'recommendations': [r.to_dict() for r in recs],
    })


def _seed_recommendations(org_id, treasury, nw):
    samples = []
    if treasury.get('funding_deficit', 0) > 0:
        samples.append(AIRecommendation(
            organization_id=org_id,
            title='Funding gap detected',
            body=f"Upcoming IPOs need ₹{treasury['funding_deficit']:,.0f} more. Review transfers or bank balances.",
            action_type='treasury', priority='high',
        ))
    banks = treasury.get('bank_strip', [])
    if len(banks) >= 2:
        rich, poor = banks[0], banks[-1]
        if rich['available'] > poor['available'] * 2:
            samples.append(AIRecommendation(
                organization_id=org_id,
                title=f"Rebalance {rich['bank_name']} → {poor['bank_name']}",
                body=f"Move funds to balance ASBA headroom across banks.",
                action_type='transfer', priority='medium',
            ))
    open_ipos = IPO.query.filter_by(organization_id=org_id, status='Open').all()
    for ipo in open_ipos[:2]:
        samples.append(AIRecommendation(
            organization_id=org_id,
            title=f"{ipo.ipo_name} — Priority {(ipo.ai_rating or 'B+')}",
            body=f"Score {ipo.ipo_score or 75}/100. GMP ₹{ipo.gmp or 0}. Consider allocation.",
            action_type='ipo', priority='high' if (ipo.ipo_score or 0) > 80 else 'medium',
        ))
    for s in samples:
        db.session.add(s)
    db.session.commit()


@fo_bp.route('/treasury', methods=['GET'])
@require_auth()
def treasury():
    org_id = g.organization_id
    refresh_bank_blocked(org_id)
    settlement = get_transfer_settlement(org_id)
    return jsonify({
        **get_treasury_summary(org_id),
        'settlement': settlement,
        'net_worth': get_net_worth(org_id),
    })


# ---------- Investor Master ----------

@fo_bp.route('/investors', methods=['GET'])
@require_auth()
def list_investors_fo():
    rows = Investor.query.filter_by(organization_id=g.organization_id).order_by(
        Investor.priority_rank, Investor.name
    ).all()
    return jsonify([i.to_dict(include_metrics=True) for i in rows])


@fo_bp.route('/investors/<int:id>', methods=['GET'])
@require_auth()
def get_investor(id):
    inv = Investor.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    return jsonify(inv.to_dict(include_metrics=True))


@fo_bp.route('/investors/<int:id>/profile', methods=['GET'])
@require_auth()
def investor_profile(id):
    inv = Investor.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    apps = Application.query.filter_by(
        organization_id=g.organization_id, investor_id=id
    ).order_by(Application.applied_at.desc()).all()
    transfers = Transfer.query.filter_by(organization_id=g.organization_id).filter(
        db.or_(Transfer.from_investor_id == id, Transfer.to_investor_id == id)
    ).limit(20).all()
    holdings = Holding.query.filter_by(investor_id=id).all()
    banks = BankAccount.query.filter_by(organization_id=g.organization_id).all()
    linked_banks = [
        b.to_dict() for b in banks
        if any(l.investor_id == id for l in b.investor_links)
    ]
    return jsonify({
        **inv.to_dict(include_metrics=True),
        'applications': [a.to_dict() for a in apps],
        'transfers': [t.to_dict() for t in transfers],
        'holdings': [h.to_dict() for h in holdings],
        'linked_banks': linked_banks,
    })


@fo_bp.route('/investors', methods=['POST'])
@require_write
def create_investor_fo():
    data = request.json or {}
    inv = Investor(
        organization_id=g.organization_id,
        name=data['name'],
        pan=data.get('pan'),
        demat_account=data.get('demat_account'),
        broker=data.get('broker'),
        upi=data.get('upi'),
        family_group=data.get('family_group'),
        relationship=data.get('relationship'),
        priority_rank=data.get('priority_rank', 99),
        risk_category=data.get('risk_category', 'Medium'),
        profit_sharing_pct=data.get('profit_sharing_pct', 0),
        is_active=data.get('is_active', True),
        banks=data.get('banks'),
    )
    db.session.add(inv)
    db.session.flush()
    for c in data.get('contacts', []):
        db.session.add(InvestorContact(
            investor_id=inv.id,
            contact_type=c.get('contact_type', 'Friend'),
            name=c.get('name', ''),
            phone=c.get('phone'),
            notes=c.get('notes'),
        ))
    db.session.commit()
    return jsonify(inv.to_dict(include_metrics=True)), 201


@fo_bp.route('/investors/<int:id>', methods=['PUT'])
@require_write
def update_investor_fo(id):
    inv = Investor.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    for field in ['name', 'pan', 'demat_account', 'broker', 'upi', 'family_group',
                  'relationship', 'priority_rank', 'risk_category', 'profit_sharing_pct',
                  'is_active', 'banks']:
        if field in data:
            setattr(inv, field, data[field])
    if 'contacts' in data:
        InvestorContact.query.filter_by(investor_id=inv.id).delete()
        for c in data['contacts']:
            db.session.add(InvestorContact(
                investor_id=inv.id,
                contact_type=c.get('contact_type', 'Friend'),
                name=c.get('name', ''),
                phone=c.get('phone'),
                notes=c.get('notes'),
            ))
    db.session.commit()
    return jsonify(inv.to_dict(include_metrics=True))


# ---------- Bank Master ----------

@fo_bp.route('/banks', methods=['GET'])
@require_auth()
def list_banks():
    refresh_bank_blocked(g.organization_id)
    rows = BankAccount.query.filter_by(organization_id=g.organization_id).all()
    return jsonify([b.to_dict() for b in rows])


@fo_bp.route('/banks', methods=['POST'])
@require_write
def create_bank():
    data = request.json or {}
    b = BankAccount(
        organization_id=g.organization_id,
        bank_name=data['bank_name'],
        account_number=data.get('account_number'),
        current_balance=float(data.get('current_balance', 0)),
        available_balance=float(data.get('available_balance', data.get('current_balance', 0))),
        blocked_balance=float(data.get('blocked_balance', 0)),
        asba_limit=float(data.get('asba_limit', 0)),
    )
    db.session.add(b)
    db.session.flush()
    for iid in data.get('investor_ids', []):
        db.session.add(BankInvestorLink(bank_account_id=b.id, investor_id=iid))
    db.session.commit()
    return jsonify(b.to_dict()), 201


@fo_bp.route('/banks/<int:id>', methods=['PUT'])
@require_write
def update_bank(id):
    b = BankAccount.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    for field in ['bank_name', 'account_number', 'current_balance', 'available_balance',
                  'blocked_balance', 'asba_limit']:
        if field in data:
            setattr(b, field, float(data[field]) if field != 'bank_name' and field != 'account_number' else data[field])
    if 'investor_ids' in data:
        BankInvestorLink.query.filter_by(bank_account_id=b.id).delete()
        for iid in data['investor_ids']:
            db.session.add(BankInvestorLink(bank_account_id=b.id, investor_id=iid))
    db.session.commit()
    return jsonify(b.to_dict())


@fo_bp.route('/banks/<int:id>', methods=['DELETE'])
@require_write
def delete_bank(id):
    b = BankAccount.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    db.session.delete(b)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# ---------- IPO Master (extended) ----------

@fo_bp.route('/ipos', methods=['GET'])
@require_auth()
def list_ipos_fo():
    rows = IPO.query.filter_by(organization_id=g.organization_id).all()
    result = []
    for ipo in rows:
        d = ipo.to_dict()
        apps = Application.query.filter_by(ipo_id=ipo.id).all()
        d['applied_count'] = len(apps)
        d['allotted_count'] = len([a for a in apps if a.status == 'Allotted'])
        if not ipo.ipo_score:
            d['ipo_score'] = _compute_ipo_score(ipo)
        result.append(d)
    return jsonify(result)


@fo_bp.route('/ipos/<int:id>/enrich', methods=['POST'])
@require_write
def enrich_ipo_route(id):
    ipo = IPO.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    for field in ['gmp', 'ipo_score', 'ai_rating', 'risk_rating', 'subscription_times',
                  'expected_listing_gain', 'funding_requirement']:
        if field in data:
            setattr(ipo, field, data[field])
    enrich_ipo(ipo, organization_id=g.organization_id)
    db.session.commit()
    return jsonify(ipo.to_dict())


# ---------- Transfer Manager ----------

@fo_bp.route('/transfers', methods=['GET'])
@require_auth()
def list_transfers():
    rows = Transfer.query.filter_by(organization_id=g.organization_id).order_by(
        Transfer.transfer_date.desc()
    ).all()
    return jsonify({
        'transfers': [t.to_dict() for t in rows],
        'settlement': get_transfer_settlement(g.organization_id),
    })


def _resolve_transfer_party(person_key, investor_id_key, data, default_from='You'):
    inv_id = data.get(investor_id_key)
    if inv_id:
        inv = Investor.query.filter_by(id=inv_id, organization_id=g.organization_id).first()
        if inv:
            return inv.id, inv.name
    name = data.get(person_key) or default_from
    return data.get(investor_id_key), name


@fo_bp.route('/transfers', methods=['POST'])
@require_write
def create_transfer():
    data = request.json or {}
    from_id, from_name = _resolve_transfer_party('from_person', 'from_investor_id', data, 'You (Desk)')
    to_id, to_name = _resolve_transfer_party('to_person', 'to_investor_id', data, '')
    if not to_name:
        return jsonify({'error': 'Recipient required'}), 400

    t = Transfer(
        organization_id=g.organization_id,
        from_investor_id=from_id,
        to_investor_id=to_id,
        from_person=from_name,
        to_person=to_name,
        amount=float(data['amount']),
        purpose=data.get('purpose'),
        ipo_id=data.get('ipo_id'),
        status=data.get('status', 'Pending'),
        transfer_date=date.fromisoformat(data['transfer_date']) if data.get('transfer_date') else date.today(),
        settlement_due_date=date.fromisoformat(data['settlement_due_date']) if data.get('settlement_due_date') else None,
        notes=data.get('notes'),
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@fo_bp.route('/transfers/<int:id>', methods=['PUT'])
@require_write
def update_transfer(id):
    t = Transfer.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    if 'from_investor_id' in data or 'from_person' in data:
        fid, fname = _resolve_transfer_party('from_person', 'from_investor_id', data, t.from_person)
        t.from_investor_id = fid
        t.from_person = fname
    if 'to_investor_id' in data or 'to_person' in data:
        tid, tname = _resolve_transfer_party('to_person', 'to_investor_id', data, t.to_person)
        t.to_investor_id = tid
        t.to_person = tname
    for field in ['amount', 'purpose', 'ipo_id', 'status', 'notes']:
        if field in data:
            setattr(t, field, data[field] if field != 'amount' else float(data[field]))
    if 'transfer_date' in data and data['transfer_date']:
        t.transfer_date = date.fromisoformat(data['transfer_date'])
    db.session.commit()
    return jsonify(t.to_dict())


@fo_bp.route('/transfers/<int:id>', methods=['DELETE'])
@require_write
def delete_transfer(id):
    t = Transfer.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    db.session.delete(t)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# ---------- AI Allocation ----------

@fo_bp.route('/allocation/optimize', methods=['POST'])
@require_auth()
def allocation_optimize():
    data = request.json or {}
    return jsonify(optimize_allocation(
        g.organization_id,
        data.get('ipo_id'),
        data.get('available_funds', 0),
    ))


@fo_bp.route('/allocation/execute', methods=['POST'])
@require_write
def allocation_execute():
    data = request.json or {}
    return jsonify(execute_allocation(
        g.organization_id,
        data.get('ipo_id'),
        data.get('investor_ids', []),
    ))


# ---------- Kanban ----------

KANBAN_STAGES = ['Draft', 'Applied', 'ASBA Blocked', 'Allotted', 'Refunded', 'Listed', 'Sold']


@fo_bp.route('/kanban', methods=['GET'])
@require_auth()
def kanban_board():
    apps = Application.query.filter_by(organization_id=g.organization_id).all()
    board = {s: [] for s in KANBAN_STAGES}
    for a in apps:
        stage = a.kanban_stage or a.status or 'Applied'
        if stage == 'Not Allotted':
            stage = 'Refunded'
        if stage not in board:
            stage = 'Applied'
        d = a.to_dict()
        board[stage].append(d)
    return jsonify({'stages': KANBAN_STAGES, 'board': board})


@fo_bp.route('/kanban/<int:app_id>/move', methods=['PUT'])
@require_write
def kanban_move(app_id):
    app = Application.query.filter_by(id=app_id, organization_id=g.organization_id).first_or_404()
    stage = (request.json or {}).get('kanban_stage')
    if stage not in KANBAN_STAGES:
        return jsonify({'error': 'Invalid stage'}), 400
    app.kanban_stage = stage
    status_map = {
        'Draft': 'Applied', 'Applied': 'Applied', 'ASBA Blocked': 'Applied',
        'Allotted': 'Allotted', 'Refunded': 'Not Allotted', 'Listed': 'Allotted', 'Sold': 'Allotted',
    }
    app.status = status_map.get(stage, app.status)
    db.session.commit()
    return jsonify(app.to_dict())


# ---------- Allotment Center ----------

@fo_bp.route('/allotment-center', methods=['GET'])
@require_auth()
def allotment_center():
    ipos = IPO.query.filter_by(organization_id=g.organization_id).all()
    result = []
    for ipo in ipos:
        apps = Application.query.filter_by(organization_id=g.organization_id, ipo_id=ipo.id).all()
        applied = len(apps)
        allotted = len([a for a in apps if a.status == 'Allotted'])
        expected_profit = round(sum(a.profit for a in apps if a.status == 'Allotted'), 2)
        reg = registrar_info(ipo.ipo_name)
        result.append({
            'ipo_id': ipo.id,
            'ipo_name': ipo.ipo_name,
            'lifecycle_stage': ipo.lifecycle_stage,
            'applied': applied,
            'allotted': allotted,
            'success_rate_pct': round(allotted / applied * 100, 1) if applied else 0,
            'expected_profit': expected_profit,
            **reg,
        })
    return jsonify(result)


@fo_bp.route('/registrars', methods=['GET'])
@require_auth()
def registrars_list():
    return jsonify(list_registrars())


@fo_bp.route('/registrars/<int:ipo_id>', methods=['GET'])
@require_auth()
def registrar_for_ipo(ipo_id):
    ipo = IPO.query.filter_by(id=ipo_id, organization_id=g.organization_id).first_or_404()
    return jsonify(registrar_info(ipo.ipo_name))


@fo_bp.route('/allotment-center/<int:ipo_id>/check-registrar', methods=['POST'])
@require_write
def check_registrar_allotment(ipo_id):
    from registrar_check_service import batch_check_ipo_applications
    ipo = IPO.query.filter_by(id=ipo_id, organization_id=g.organization_id).first_or_404()
    apps = Application.query.filter_by(organization_id=g.organization_id, ipo_id=ipo_id).all()
    if not apps:
        return jsonify({'error': 'No applications for this IPO'}), 400

    apply_updates = (request.json or {}).get('apply_updates', False)
    results = batch_check_ipo_applications(ipo, apps)
    updated = 0
    now = datetime.utcnow()

    for r in results:
        app = next((a for a in apps if a.id == r['application_id']), None)
        if not app:
            continue
        app.registrar_check_status = r.get('status')
        app.registrar_checked_at = now
        if apply_updates and r.get('status') in ('Allotted', 'Not Allotted'):
            app.status = r['status']
            app.kanban_stage = r['status'] if r['status'] == 'Allotted' else 'Refunded'
            if r['status'] == 'Allotted':
                app.allotted_at = now
            updated += 1

    db.session.commit()
    allotted = len([r for r in results if r.get('status') == 'Allotted'])
    not_allotted = len([r for r in results if r.get('status') == 'Not Allotted'])
    return jsonify({
        'ipo_name': ipo.ipo_name,
        'checked': len(results),
        'allotted_found': allotted,
        'not_allotted_found': not_allotted,
        'applications_updated': updated,
        'results': results,
    })


# ---------- Portfolio / Zerodha Kite ----------

@fo_bp.route('/broker/zerodha/status', methods=['GET'])
@require_auth()
def zerodha_status():
    from kite_service import kite_configured, kite_redirect_uri
    return jsonify({
        'configured': kite_configured(),
        'redirect_uri': kite_redirect_uri(),
        'setup_hint': 'Set KITE_API_KEY and KITE_API_SECRET in .env. Register redirect URL in Kite developer console.',
    })


@fo_bp.route('/broker/zerodha/start', methods=['POST'])
@require_write
def zerodha_start():
    from kite_service import kite_configured, build_login_url, new_oauth_state, default_token_expiry
    if not kite_configured():
        return jsonify({'error': 'Kite Connect not configured. Add KITE_API_KEY and KITE_API_SECRET to .env'}), 400

    data = request.json or {}
    investor_id = data.get('investor_id')
    if not investor_id:
        return jsonify({'error': 'investor_id required'}), 400

    inv = Investor.query.filter_by(id=investor_id, organization_id=g.organization_id).first_or_404()
    state = new_oauth_state()

    conn = BrokerConnection.query.filter_by(
        organization_id=g.organization_id,
        investor_id=inv.id,
        broker_name='Zerodha',
    ).first()
    if not conn:
        conn = BrokerConnection(
            organization_id=g.organization_id,
            investor_id=inv.id,
            broker_name='Zerodha',
            is_connected=False,
        )
        db.session.add(conn)
    conn.oauth_state = state
    conn.access_token = None
    conn.is_connected = False
    conn.token_expires_at = default_token_expiry()
    db.session.commit()

    return jsonify({
        'login_url': build_login_url(state),
        'connection_id': conn.id,
        'message': 'Redirect user to Zerodha login',
    })


@fo_bp.route('/broker/zerodha/disconnect/<int:conn_id>', methods=['POST'])
@require_write
def zerodha_disconnect(conn_id):
    conn = BrokerConnection.query.filter_by(
        id=conn_id, organization_id=g.organization_id, broker_name='Zerodha',
    ).first_or_404()
    Holding.query.filter_by(broker_connection_id=conn.id).delete()
    conn.access_token = None
    conn.is_connected = False
    conn.oauth_state = None
    db.session.commit()
    return jsonify({'message': 'Zerodha disconnected'})


@fo_bp.route('/portfolio', methods=['GET'])
@require_auth()
def portfolio():
    org_id = g.organization_id
    investors = Investor.query.filter_by(organization_id=org_id).all()
    by_investor = []
    for inv in investors:
        conns = BrokerConnection.query.filter_by(investor_id=inv.id).all()
        holdings = Holding.query.filter_by(investor_id=inv.id).all()
        brokers = [{
            'broker': c.broker_name,
            'connection_id': c.id,
            'value': c.to_dict()['portfolio_value'],
            'connected': c.is_connected,
            'live': c.broker_name == 'Zerodha' and bool(c.access_token),
            'client_id': c.client_id,
            'last_synced_at': c.last_synced_at.isoformat() if c.last_synced_at else None,
        } for c in conns]
        if not brokers and holdings:
            brokers = [{'broker': 'Manual', 'value': sum(h.market_value for h in holdings), 'connected': True}]
        by_investor.append({
            'investor_id': inv.id,
            'investor_name': inv.name,
            'brokers': brokers,
            'total_value': round(sum(h.market_value for h in holdings), 2),
            'holdings': [h.to_dict() for h in holdings],
        })
    total = round(sum(i['total_value'] for i in by_investor), 2)
    return jsonify({'family_total': total, 'investors': by_investor})


@fo_bp.route('/portfolio/connect', methods=['POST'])
@require_write
def connect_broker():
    """Demo connect for non-Zerodha brokers. Use /broker/zerodha/start for live Kite OAuth."""
    from kite_service import kite_configured
    data = request.json or {}
    broker = data.get('broker_name', '')
    if broker == 'Zerodha' and kite_configured():
        return jsonify({
            'error': 'Use Zerodha OAuth',
            'use_oauth': True,
            'start_url': '/api/fo/broker/zerodha/start',
        }), 400

    conn = BrokerConnection(
        organization_id=g.organization_id,
        investor_id=data['investor_id'],
        broker_name=broker,
        client_id=data.get('client_id'),
        is_connected=True,
        last_synced_at=datetime.utcnow(),
    )
    db.session.add(conn)
    db.session.flush()
    _seed_demo_holdings(g.organization_id, data['investor_id'], conn.id, broker)
    db.session.commit()
    return jsonify({**conn.to_dict(), 'demo': True}), 201


def _seed_demo_holdings(org_id, investor_id, conn_id, broker):
    symbols = [
        ('RELIANCE', 10, 2450, 2520, 'Energy'),
        ('TCS', 5, 3800, 3920, 'IT'),
        ('HDFCBANK', 20, 1650, 1685, 'Banking'),
    ]
    for sym, qty, avg, ltp, sector in symbols:
        db.session.add(Holding(
            organization_id=org_id,
            investor_id=investor_id,
            broker_connection_id=conn_id,
            symbol=sym,
            quantity=qty,
            avg_price=avg,
            ltp=ltp,
            day_change_pct=round((ltp - avg) / avg * 100, 2),
            asset_type='Stock',
            sector=sector,
        ))


@fo_bp.route('/portfolio/refresh', methods=['POST'])
@require_write
def refresh_portfolio():
    from kite_service import sync_connection_holdings
    kite_synced = 0
    conns = BrokerConnection.query.filter_by(
        organization_id=g.organization_id, broker_name='Zerodha', is_connected=True,
    ).all()
    for conn in conns:
        if conn.access_token:
            try:
                sync_connection_holdings(conn)
                kite_synced += 1
            except Exception:
                pass
    result = refresh_holdings_prices(g.organization_id)
    result['kite_connections_synced'] = kite_synced
    return jsonify(result)


# ---------- Wealth ----------

@fo_bp.route('/wealth', methods=['GET'])
@require_auth()
def wealth():
    assets = WealthAsset.query.filter_by(organization_id=g.organization_id).all()
    nw = get_net_worth(g.organization_id)
    return jsonify({
        'net_worth': nw,
        'assets': [a.to_dict() for a in assets],
        'breakdown': {
            'cash': nw['cash'],
            'stocks': nw['stocks_holdings'],
            'ipo': nw['ipo_holdings'],
            'mutual_funds': sum(a.value for a in assets if a.asset_type == 'Mutual Fund'),
            'etf': sum(a.value for a in assets if a.asset_type == 'ETF'),
            'loans_given': nw['loans_given'],
            'loans_taken': nw['loans_taken'],
        },
    })


@fo_bp.route('/wealth/assets', methods=['POST'])
@require_write
def add_wealth_asset():
    data = request.json or {}
    a = WealthAsset(
        organization_id=g.organization_id,
        asset_type=data['asset_type'],
        name=data['name'],
        value=float(data.get('value', 0)),
        investor_id=data.get('investor_id'),
        notes=data.get('notes'),
    )
    db.session.add(a)
    db.session.commit()
    return jsonify(a.to_dict()), 201


@fo_bp.route('/wealth/assets/<int:aid>', methods=['PUT'])
@require_write
def update_wealth_asset(aid):
    a = WealthAsset.query.filter_by(id=aid, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    for field in ['asset_type', 'name', 'value', 'investor_id', 'notes']:
        if field in data:
            setattr(a, field, float(data[field]) if field == 'value' else data[field])
    db.session.commit()
    return jsonify(a.to_dict())


@fo_bp.route('/wealth/assets/<int:aid>', methods=['DELETE'])
@require_write
def delete_wealth_asset(aid):
    a = WealthAsset.query.filter_by(id=aid, organization_id=g.organization_id).first_or_404()
    db.session.delete(a)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@fo_bp.route('/quick-actions', methods=['GET'])
@require_auth()
def quick_actions():
    """Top suggested actions for home dashboard."""
    org_id = g.organization_id
    treasury = get_treasury_summary(org_id)
    open_ipos = IPO.query.filter_by(organization_id=org_id, status='Open').all()
    open_ipos.sort(key=lambda i: i.ipo_score or 0, reverse=True)
    top = open_ipos[0] if open_ipos else None
    actions = []
    if treasury.get('funding_deficit', 0) > 0:
        actions.append({
            'type': 'treasury',
            'title': f"Fund gap: ₹{treasury['funding_deficit']:,.0f}",
            'view': 'treasury',
        })
    if top:
        actions.append({
            'type': 'allocate',
            'title': f"Optimize {top.ipo_name}",
            'view': 'allocation',
            'ipo_id': top.id,
            'ipo_score': top.ipo_score,
        })
    pending = Transfer.query.filter_by(organization_id=org_id, status='Pending').count()
    if pending:
        actions.append({'type': 'transfer', 'title': f'{pending} pending transfers', 'view': 'transfers'})
    return jsonify({
        'available_funds': treasury.get('available_for_ipo', 0),
        'top_ipo': top.to_dict() if top else None,
        'actions': actions,
    })


@fo_bp.route('/ipos/refresh-gmp', methods=['POST'])
@require_write
def refresh_all_gmp():
    from gmp_scraper import fetch_gmp_table
    from ipo_enrich_service import enrich_ipo
    gmp_map = fetch_gmp_table()
    ipos = IPO.query.filter_by(organization_id=g.organization_id).all()
    updated = 0
    for ipo in ipos:
        from gmp_scraper import lookup_gmp
        gmp = lookup_gmp(ipo.ipo_name, gmp_map)
        if gmp is not None:
            ipo.gmp = gmp
        enrich_ipo(ipo, organization_id=g.organization_id)
        updated += 1
    db.session.commit()
    return jsonify({'message': f'Refreshed GMP for {updated} IPOs', 'gmp_sources': len(gmp_map)})


@fo_bp.route('/alerts/send-digest', methods=['POST'])
@require_write
def send_alert_digest():
    from alert_service import send_closing_digest
    ok = send_closing_digest(g.organization_id)
    return jsonify({'message': 'Alert digest sent' if ok else 'No closing IPOs or no owner email'})


@fo_bp.route('/closing-ipos', methods=['GET'])
@require_auth()
def closing_ipos():
    from datetime import date
    today = date.today()
    rows = []
    for ipo in IPO.query.filter_by(organization_id=g.organization_id, status='Open').all():
        if not ipo.bidding_close_date:
            continue
        days = (ipo.bidding_close_date - today).days
        if days < 0 or days > 14:
            continue
        rows.append({
            'ipo_id': ipo.id,
            'ipo_name': ipo.ipo_name,
            'bidding_close_date': ipo.bidding_close_date.isoformat(),
            'days_left': days,
            'ipo_score': ipo.ipo_score,
            'gmp': ipo.gmp,
            'funding_requirement': ipo.funding_requirement,
            'urgency': 'critical' if days <= 1 else 'high' if days <= 3 else 'medium',
        })
    rows.sort(key=lambda x: x['days_left'])
    return jsonify(rows)


@fo_bp.route('/reports/export', methods=['GET'])
@require_auth()
def export_family_report():
    import io
    import pandas as pd
    from flask import send_file
    from treasury_service import get_net_worth, get_treasury_summary

    org_id = g.organization_id
    nw = get_net_worth(org_id)
    treasury = get_treasury_summary(org_id)
    investors = Investor.query.filter_by(organization_id=org_id).all()
    ipos = IPO.query.filter_by(organization_id=org_id).all()
    apps = Application.query.filter_by(organization_id=org_id).all()
    banks = BankAccount.query.filter_by(organization_id=org_id).all()

    summary = pd.DataFrame([
        {'Metric': k, 'Value': v} for k, v in {
            'Net Worth': nw['net_worth'], 'Cash': nw['cash'],
            'Blocked': nw['blocked'], 'Stocks': nw['stocks_holdings'],
            'IPO Holdings': nw['ipo_holdings'], 'Funding Required': treasury['funding_required'],
            'Funding Deficit': treasury['funding_deficit'],
        }.items()
    ])
    inv_df = pd.DataFrame([{
        'Name': i.name, 'PAN': i.pan, 'Priority': i.priority_rank,
        'Risk': i.risk_category, 'Family': i.family_group, 'Broker': i.broker,
    } for i in investors])
    ipo_df = pd.DataFrame([{
        'IPO': i.ipo_name, 'Score': i.ipo_score, 'GMP': i.gmp,
        'Status': i.status, 'Funding Req': i.funding_requirement,
    } for i in ipos])
    app_df = pd.DataFrame([{
        'Investor': a.investor_name, 'IPO': a.ipo_name, 'Status': a.status,
        'Amount': a.application_amount, 'Profit': a.profit,
    } for a in apps])
    bank_df = pd.DataFrame([{
        'Bank': b.bank_name, 'Balance': b.current_balance,
        'Blocked': b.blocked_balance, 'ASBA Limit': b.asba_limit,
    } for b in banks])

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        summary.to_excel(writer, sheet_name='Summary', index=False)
        inv_df.to_excel(writer, sheet_name='Investors', index=False)
        ipo_df.to_excel(writer, sheet_name='IPOs', index=False)
        app_df.to_excel(writer, sheet_name='Applications', index=False)
        bank_df.to_excel(writer, sheet_name='Banks', index=False)
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name='family_office_report.xlsx')


@fo_bp.route('/notifications', methods=['GET'])
@require_auth()
def notifications():
    """Live alerts: closing IPOs, bank headroom, pending transfers."""
    from datetime import date, timedelta
    from treasury_service import get_treasury_summary
    org_id = g.organization_id
    alerts = []
    today = date.today()
    for ipo in IPO.query.filter_by(organization_id=org_id, status='Open').all():
        if ipo.bidding_close_date:
            days = (ipo.bidding_close_date - today).days
            if 0 <= days <= 3:
                alerts.append({
                    'type': 'ipo_closing',
                    'priority': 'high',
                    'title': f'{ipo.ipo_name} closes in {days}d',
                    'body': f'Bidding closes {ipo.bidding_close_date.isoformat()}',
                    'action_view': 'allocation',
                })
    treasury = get_treasury_summary(org_id)
    if treasury.get('funding_deficit', 0) > 0:
        alerts.append({
            'type': 'funding',
            'priority': 'high',
            'title': 'IPO funding deficit',
            'body': f"Need {treasury['funding_deficit']:,.0f} more for open IPOs",
            'action_view': 'treasury',
        })
    pending = Transfer.query.filter_by(organization_id=org_id, status='Pending').count()
    if pending:
        alerts.append({
            'type': 'transfer',
            'priority': 'medium',
            'title': f'{pending} pending transfer(s)',
            'body': 'Settle before next IPO apply cycle',
            'action_view': 'transfers',
        })
    return jsonify({'count': len(alerts), 'alerts': alerts})


# ---------- AI Advisor ----------

@fo_bp.route('/advisor', methods=['POST'])
@require_auth()
def advisor():
    data = request.json or {}
    question = data.get('question', '')
    if not question:
        return jsonify({'error': 'Question required'}), 400
    return jsonify(advise(g.organization_id, question))


# ---------- Market ----------

@fo_bp.route('/market/pulse', methods=['GET'])
@require_auth()
def market_pulse():
    return jsonify(get_market_pulse(g.organization_id))


@fo_bp.route('/market/refresh', methods=['POST'])
@require_write
def market_refresh():
    return jsonify(refresh_holdings_prices(g.organization_id))


# ---------- Demo seed ----------

@fo_bp.route('/seed-demo', methods=['POST'])
@require_write
def seed_demo_data():
    """Seed rich demo data for family office dashboard."""
    org_id = g.organization_id
    if BankAccount.query.filter_by(organization_id=org_id).count() > 0:
        return jsonify({'message': 'Demo data already exists'})
    banks_data = [
        ('HDFC Bank', '****4521', 1200000, 950000, 250000, 1500000),
        ('ICICI Bank', '****8832', 800000, 650000, 150000, 1000000),
        ('SBI', '****1102', 500000, 420000, 80000, 600000),
        ('Axis Bank', '****3390', 300000, 280000, 20000, 400000),
    ]
    for name, acc, bal, avail, blocked, asba in banks_data:
        db.session.add(BankAccount(
            organization_id=org_id, bank_name=name, account_number=acc,
            current_balance=bal, available_balance=avail, blocked_balance=blocked, asba_limit=asba,
        ))
    investors = Investor.query.filter_by(organization_id=org_id).limit(5).all()
    for i, inv in enumerate(investors):
        inv.priority_rank = i + 1
        inv.pan = f'ABCDE{i:04d}F'
        inv.demat_account = f'IN300{i:06d}'
        inv.broker = ['Zerodha', 'Angel One', 'Groww', 'Upstox', 'Zerodha'][i % 5]
        inv.risk_category = ['Low', 'Medium', 'Low', 'High', 'Medium'][i % 5]
        inv.relationship = ['Self', 'Spouse', 'Brother', 'Friend', 'Relative'][i % 5]
        if not inv.contacts:
            db.session.add(InvestorContact(investor_id=inv.id, contact_type='Friend', name='Amit Shah'))
    ipos = IPO.query.filter_by(organization_id=org_id).all()
    for ipo in ipos:
        ipo.gmp = round((ipo.purchase_price_per_share or 100) * 0.12, 2)
        ipo.ipo_score = _compute_ipo_score(ipo)
        ipo.ai_rating = 'A' if ipo.ipo_score > 85 else 'B+'
        ipo.risk_rating = 'Low' if ipo.ipo_score > 80 else 'Medium'
        ipo.funding_requirement = (ipo.lot_size or 1) * (ipo.purchase_price_per_share or 0) * max(1, len(investors))
    db.session.add(Transfer(
        organization_id=org_id, from_person='You', to_person=investors[0].name if investors else 'Amit',
        amount=250000, purpose='For upcoming IPO', status='Pending',
    ))
    db.session.add(WealthAsset(organization_id=org_id, asset_type='Mutual Fund', name='Parag Parikh Flexi Cap', value=850000))
    db.session.add(WealthAsset(organization_id=org_id, asset_type='ETF', name='Nifty Bees', value=320000))
    db.session.commit()
    return jsonify({'message': 'Demo data seeded'})
