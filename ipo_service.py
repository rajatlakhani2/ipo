from datetime import date, datetime, timedelta

from extensions import db
from models import Application, IPO, Investor, BankLimit, AuditLog


def log_audit(organization_id, user_id, entity_type, entity_id, field_name, old_value, new_value):
    entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
    )
    db.session.add(entry)


def parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    return datetime.strptime(value[:10], '%Y-%m-%d').date()


def ipo_allows_apply(ipo):
    if ipo.lifecycle_stage in ('Closed', 'Listed'):
        return False, 'IPO is closed for new applications'
    if ipo.status == 'Closed':
        return False, 'IPO status is Closed'
    if ipo.bidding_close_date and ipo.bidding_close_date < date.today():
        return False, 'Bidding period has ended'
    return True, None


def validate_status_change(ipo, new_status):
    today = date.today()
    if new_status == 'Allotted' and ipo.allotment_date and ipo.allotment_date > today:
        return False, 'Cannot mark Allotted before allotment date'
    return True, None


def bank_headroom(organization_id, bank_name, additional_amount=0):
    if not bank_name:
        return True, None, 0, 0
    limit = BankLimit.query.filter_by(organization_id=organization_id, bank_name=bank_name).first()
    blocked = (
        db.session.query(db.func.coalesce(db.func.sum(Application.application_amount), 0))
        .filter(
            Application.organization_id == organization_id,
            Application.bank_name == bank_name,
            Application.status == 'Applied',
        )
        .scalar()
    ) or 0
    max_cap = limit.max_blocked_amount if limit else None
    if max_cap is None:
        return True, None, blocked, None
    remaining = max_cap - blocked
    if blocked + additional_amount > max_cap:
        return False, f'Bank {bank_name} exceeds ASBA headroom (blocked {blocked}, cap {max_cap})', blocked, max_cap
    return True, None, blocked, max_cap


def command_board_data(organization_id):
    today = date.today()
    week_end = today + timedelta(days=7)

    ipos = IPO.query.filter_by(organization_id=organization_id).all()
    investors = Investor.query.filter_by(organization_id=organization_id).all()
    applications = Application.query.filter_by(organization_id=organization_id).all()

    open_ipos = [i for i in ipos if i.lifecycle_stage in ('Open', 'Upcoming') or i.status == 'Open']
    closing_soon = [
        i for i in ipos
        if i.bidding_close_date and today <= i.bidding_close_date <= week_end
    ]
    listing_soon = [
        i for i in ipos
        if i.listing_date and today <= i.listing_date <= week_end
    ]

    not_applied = []
    for ipo in open_ipos:
        applied_ids = {a.investor_id for a in applications if a.ipo_id == ipo.id}
        for inv in investors:
            if inv.id not in applied_ids:
                not_applied.append({
                    'investor_id': inv.id,
                    'investor_name': inv.name,
                    'ipo_id': ipo.id,
                    'ipo_name': ipo.ipo_name,
                })

    bank_blocked = {}
    for app in applications:
        if app.status == 'Applied' and app.bank_name:
            bank_blocked[app.bank_name] = bank_blocked.get(app.bank_name, 0) + (app.application_amount or 0)

    limits = {bl.bank_name: bl.max_blocked_amount for bl in BankLimit.query.filter_by(organization_id=organization_id).all()}
    bank_alerts = []
    for bank, blocked in bank_blocked.items():
        cap = limits.get(bank)
        if cap and blocked >= cap * 0.9:
            bank_alerts.append({'bank_name': bank, 'blocked': round(blocked, 2), 'cap': cap, 'remaining': round(cap - blocked, 2)})

    return {
        'open_ipo_count': len(open_ipos),
        'closing_soon': [{'id': i.id, 'ipo_name': i.ipo_name, 'bidding_close_date': i.bidding_close_date.isoformat() if i.bidding_close_date else None} for i in closing_soon],
        'listing_soon': [{'id': i.id, 'ipo_name': i.ipo_name, 'listing_date': i.listing_date.isoformat() if i.listing_date else None} for i in listing_soon],
        'not_applied_count': len(not_applied),
        'not_applied_preview': not_applied[:20],
        'bank_alerts': bank_alerts,
        'total_blocked': round(sum(bank_blocked.values()), 2),
    }


def calendar_events(organization_id):
    events = []
    for ipo in IPO.query.filter_by(organization_id=organization_id).all():
        for label, d in [
            ('IPO Open', ipo.ipo_date),
            ('Bidding Close', ipo.bidding_close_date),
            ('Allotment', ipo.allotment_date),
            ('Listing', ipo.listing_date),
        ]:
            if d:
                events.append({
                    'ipo_id': ipo.id,
                    'ipo_name': ipo.ipo_name,
                    'event': label,
                    'date': d.isoformat(),
                    'lifecycle_stage': ipo.lifecycle_stage,
                })
    events.sort(key=lambda x: x['date'])
    return events


def ipo_scorecard(organization_id):
    cards = []
    for ipo in IPO.query.filter_by(organization_id=organization_id).all():
        apps = Application.query.filter_by(organization_id=organization_id, ipo_id=ipo.id).all()
        applied = len(apps)
        allotted = sum(1 for a in apps if a.status == 'Allotted')
        not_allotted = sum(1 for a in apps if a.status == 'Not Allotted')
        profit = sum(a.profit for a in apps if a.status == 'Allotted')
        blocked = sum(a.application_amount or 0 for a in apps if a.status == 'Applied')
        hit_rate = round((allotted / applied * 100), 1) if applied else 0
        cards.append({
            'ipo_id': ipo.id,
            'ipo_name': ipo.ipo_name,
            'lifecycle_stage': ipo.lifecycle_stage,
            'applied': applied,
            'allotted': allotted,
            'not_allotted': not_allotted,
            'hit_rate_pct': hit_rate,
            'profit': round(profit, 2),
            'blocked_amount': round(blocked, 2),
        })
    cards.sort(key=lambda x: x['profit'], reverse=True)
    return cards


def global_search(organization_id, query):
    q = f'%{query.strip()}%'
    if not query.strip():
        return {'investors': [], 'ipos': [], 'applications': []}
    investors = Investor.query.filter(
        Investor.organization_id == organization_id,
        Investor.name.ilike(q),
    ).limit(20).all()
    ipos = IPO.query.filter(
        IPO.organization_id == organization_id,
        IPO.ipo_name.ilike(q),
    ).limit(20).all()
    apps = (
        Application.query.filter_by(organization_id=organization_id)
        .join(Investor, Application.investor_id == Investor.id)
        .join(IPO, Application.ipo_id == IPO.id)
        .filter(
            db.or_(
                Investor.name.ilike(q),
                IPO.ipo_name.ilike(q),
                Application.application_ref.ilike(q),
            )
        )
        .limit(30)
        .all()
    )
    return {
        'investors': [{'id': i.id, 'name': i.name} for i in investors],
        'ipos': [{'id': i.id, 'ipo_name': i.ipo_name} for i in ipos],
        'applications': [a.to_dict() for a in apps],
    }
