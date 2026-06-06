"""AI Allocation Engine — rule-based optimizer for IPO applications."""
from models import Application, BankAccount, IPO, Investor
from extensions import db


def optimize_allocation(org_id, ipo_id, available_funds):
    ipo = IPO.query.filter_by(id=ipo_id, organization_id=org_id).first()
    if not ipo:
        return {'error': 'IPO not found'}

    investors = Investor.query.filter_by(organization_id=org_id, is_active=True).order_by(
        Investor.priority_rank
    ).all()
    if not investors:
        return {'error': 'No active investors'}

    lot_cost = (ipo.lot_size or ipo.num_shares or 1) * (ipo.purchase_price_per_share or 0)
    if not lot_cost:
        lot_cost = ipo.funding_requirement or 15000

    banks = {b.bank_name: b for b in BankAccount.query.filter_by(organization_id=org_id).all()}
    existing = {
        (a.investor_id, a.ipo_id)
        for a in Application.query.filter_by(organization_id=org_id, ipo_id=ipo_id).all()
    }

    scored = []
    for inv in investors:
        if (inv.id, ipo_id) in existing:
            continue
        apps = Application.query.filter_by(organization_id=org_id, investor_id=inv.id).all()
        allotted = [a for a in apps if a.status == 'Allotted']
        success = len(allotted) / len(apps) if apps else 0.5
        priority_score = max(0, 100 - (inv.priority_rank or 99))
        ipo_score = ipo.ipo_score or 70
        gmp_boost = min(30, (ipo.gmp or 0) / max(1, ipo.purchase_price_per_share or 1) * 100)
        risk_penalty = {'Low': 0, 'Medium': 5, 'High': 15}.get(inv.risk_category or 'Medium', 5)
        total_score = priority_score * 0.35 + success * 100 * 0.25 + ipo_score * 0.25 + gmp_boost * 0.15 - risk_penalty

        bank_names = [b.strip() for b in (inv.banks or '').split(',') if b.strip()]
        headroom = 0
        for bn in bank_names:
            ba = banks.get(bn)
            if ba:
                headroom = max(headroom, (ba.asba_limit or ba.current_balance or 0) - (ba.blocked_balance or 0))
        if not bank_names:
            headroom = lot_cost

        scored.append({
            'investor_id': inv.id,
            'investor_name': inv.name,
            'priority_rank': inv.priority_rank,
            'score': round(total_score, 1),
            'success_ratio': round(success * 100, 1),
            'headroom': headroom,
            'lot_cost': lot_cost,
            'eligible': headroom >= lot_cost,
        })

    scored.sort(key=lambda x: (-x['score'], x['priority_rank']))
    remaining = float(available_funds or 0)
    apply_list = []
    skip_list = []

    for s in scored:
        if not s['eligible']:
            skip_list.append({**s, 'reason': 'Insufficient bank ASBA headroom'})
            continue
        if remaining < s['lot_cost']:
            skip_list.append({**s, 'reason': 'Available funds exhausted'})
            continue
        apply_list.append({**s, 'reason': f"Score {s['score']} — priority & {s['success_ratio']}% success ratio"})
        remaining -= s['lot_cost']

    for s in scored:
        if s['investor_id'] not in {a['investor_id'] for a in apply_list} and s['investor_id'] not in {x['investor_id'] for x in skip_list}:
            skip_list.append({**s, 'reason': 'Lower expected ROI vs selected investors'})

    expected_profit = 0
    if ipo.gmp and ipo.lot_size:
        expected_profit = round(ipo.gmp * ipo.lot_size * len(apply_list) * 0.6, 2)
    elif ipo.expected_listing_gain:
        expected_profit = round(ipo.expected_listing_gain * len(apply_list), 2)

    return {
        'ipo_id': ipo_id,
        'ipo_name': ipo.ipo_name,
        'available_funds': available_funds,
        'funds_used': round(float(available_funds or 0) - remaining, 2),
        'funds_remaining': round(remaining, 2),
        'lot_cost': lot_cost,
        'apply': apply_list,
        'skip': skip_list,
        'expected_profit': expected_profit,
    }


def execute_allocation(org_id, ipo_id, investor_ids):
    ipo = IPO.query.filter_by(id=ipo_id, organization_id=org_id).first_or_404()
    lot_cost = (ipo.lot_size or ipo.num_shares or 1) * (ipo.purchase_price_per_share or 0)
    created = []
    errors = []
    for iid in investor_ids:
        exists = Application.query.filter_by(
            organization_id=org_id, investor_id=iid, ipo_id=ipo_id
        ).first()
        if exists:
            errors.append({'investor_id': iid, 'error': 'Already applied'})
            continue
        inv = Investor.query.get(iid)
        bank = (inv.banks or '').split(',')[0].strip() if inv and inv.banks else None
        app = Application(
            organization_id=org_id,
            investor_id=iid,
            ipo_id=ipo_id,
            application_amount=lot_cost,
            status='Applied',
            kanban_stage='Applied',
            bank_name=bank,
        )
        db.session.add(app)
        created.append(iid)
    db.session.commit()
    return {'created': len(created), 'investor_ids': created, 'errors': errors}
