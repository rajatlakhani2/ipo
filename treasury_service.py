"""Treasury, net worth, and funding gap calculations."""
from datetime import date, timedelta

from models import (
    Application, BankAccount, Holding, IPO, Investor, Transfer, WealthAsset,
)
from extensions import db


def _sum_blocked(org_id):
    apps = Application.query.filter_by(organization_id=org_id).all()
    return round(sum(a.application_amount or 0 for a in apps if a.status == 'Applied'), 2)


def _sum_refunds(org_id):
    apps = Application.query.filter_by(organization_id=org_id).all()
    return round(sum(a.application_amount or 0 for a in apps if a.kanban_stage == 'Refunded' or a.status == 'Not Allotted'), 2)


def _sum_cash(org_id):
    banks = BankAccount.query.filter_by(organization_id=org_id).all()
    if banks:
        return round(sum(b.available_balance or b.current_balance or 0 for b in banks), 2)
    return 0


def _sum_holdings(org_id):
    holdings = Holding.query.filter_by(organization_id=org_id).all()
    return round(sum(h.market_value for h in holdings), 2)


def _sum_ipo_holdings(org_id):
    apps = Application.query.filter_by(organization_id=org_id).all()
    total = 0
    for a in apps:
        if a.status in ('Allotted', 'Listed') or a.kanban_stage in ('Listed', 'Sold'):
            total += a.application_amount or 0
    return round(total, 2)


def _sum_wealth_assets(org_id):
    assets = WealthAsset.query.filter_by(organization_id=org_id).all()
    return round(sum(a.value or 0 for a in assets), 2)


def get_treasury_summary(org_id):
    cash = _sum_cash(org_id)
    blocked = _sum_blocked(org_id)
    refunds = _sum_refunds(org_id)
    banks = BankAccount.query.filter_by(organization_id=org_id).all()
    if not banks:
        blocked_calc = blocked
        bank_strip = []
    else:
        bank_strip = [{
            'bank_name': b.bank_name,
            'balance': b.current_balance or 0,
            'blocked': b.blocked_balance or 0,
            'available': b.available_balance or 0,
        } for b in banks]
        blocked_calc = round(sum(b.blocked_balance or 0 for b in banks), 2) or blocked

    open_ipos = IPO.query.filter_by(organization_id=org_id, status='Open').all()
    funding_required = round(sum(i.funding_requirement or (i.lot_size or 1) * (i.purchase_price_per_share or 0) * 10 for i in open_ipos), 2)
    available = cash + refunds
    deficit = max(0, round(funding_required - available, 2))

    return {
        'cash': cash,
        'blocked': blocked_calc,
        'refunds': refunds,
        'available_for_ipo': available,
        'funding_required': funding_required,
        'funding_deficit': deficit,
        'bank_strip': bank_strip,
    }


def get_net_worth(org_id):
    treasury = get_treasury_summary(org_id)
    holdings = _sum_holdings(org_id)
    ipo_holdings = _sum_ipo_holdings(org_id)
    wealth = _sum_wealth_assets(org_id)
    loans_given = round(sum(a.value for a in WealthAsset.query.filter_by(
        organization_id=org_id, asset_type='Loan Given')), 2)
    loans_taken = round(sum(a.value for a in WealthAsset.query.filter_by(
        organization_id=org_id, asset_type='Loan Taken')), 2)

    total = round(
        treasury['cash'] + holdings + ipo_holdings + wealth + loans_given - loans_taken, 2
    )
    return {
        'net_worth': total,
        'cash': treasury['cash'],
        'blocked': treasury['blocked'],
        'refunds': treasury['refunds'],
        'stocks_holdings': holdings,
        'ipo_holdings': ipo_holdings,
        'other_assets': wealth,
        'loans_given': loans_given,
        'loans_taken': loans_taken,
    }


def get_transfer_settlement(org_id):
    today = date.today()
    transfers = Transfer.query.filter_by(organization_id=org_id).all()
    pending = [t for t in transfers if t.status == 'Pending']
    receivable = round(sum(t.amount for t in pending if t.to_person == 'You' or t.to_investor_id), 2)
    payable = round(sum(t.amount for t in pending if t.from_person == 'You' or t.from_investor_id), 2)
    over_30 = [t for t in pending if t.transfer_date and (today - t.transfer_date).days > 30]
    over_60 = [t for t in pending if t.transfer_date and (today - t.transfer_date).days > 60]
    return {
        'outstanding_receivable': receivable,
        'outstanding_payable': payable,
        'pending_over_30': len(over_30),
        'pending_over_60': len(over_60),
        'pending_amount_30': round(sum(t.amount for t in over_30), 2),
        'pending_amount_60': round(sum(t.amount for t in over_60), 2),
    }


def refresh_bank_blocked(org_id):
    """Sync blocked_balance on bank accounts from applications."""
    apps = Application.query.filter_by(organization_id=org_id).filter(
        Application.status == 'Applied'
    ).all()
    by_bank = {}
    for a in apps:
        if a.bank_name:
            by_bank[a.bank_name] = by_bank.get(a.bank_name, 0) + (a.application_amount or 0)
    banks = BankAccount.query.filter_by(organization_id=org_id).all()
    for b in banks:
        blocked = by_bank.get(b.bank_name, 0)
        b.blocked_balance = blocked
        b.available_balance = max(0, (b.current_balance or 0) - blocked)
    db.session.commit()
