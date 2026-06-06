"""AI Advisor — rule-based IPO readiness Q&A."""
import re

from models import Application, BankAccount, IPO, Investor, Transfer
from allocation_service import optimize_allocation
from treasury_service import get_treasury_summary


def parse_ipo_from_question(question, org_id):
    q = question.lower()
    ipos = IPO.query.filter_by(organization_id=org_id).all()
    for ipo in ipos:
        name = ipo.ipo_name.lower()
        short = name.split()[0] if name else ''
        if short and short in q:
            return ipo
        if name in q:
            return ipo
    open_ipos = [i for i in ipos if i.status == 'Open']
    return open_ipos[0] if open_ipos else (ipos[0] if ipos else None)


def advise(org_id, question):
    treasury = get_treasury_summary(org_id)
    ipo = parse_ipo_from_question(question, org_id)

    if not ipo:
        return {
            'answer': 'No IPO found matching your question. Add IPOs or specify the name (e.g. "Can I apply for NSDL IPO?").',
            'confidence': 'low',
            'actions': [],
        }

    pending_transfers = Transfer.query.filter_by(organization_id=org_id, status='Pending').count()
    available = treasury['available_for_ipo']
    funding_needed = ipo.funding_requirement or (ipo.lot_size or 1) * (ipo.purchase_price_per_share or 0) * 5

    alloc = optimize_allocation(org_id, ipo.id, available)
    apply_names = [a['investor_name'] for a in alloc.get('apply', [])[:6]]
    expected_profit = alloc.get('expected_profit', 0)

    can_apply = available >= funding_needed * 0.3 and len(alloc.get('apply', [])) > 0
    transfer_needed = max(0, funding_needed - available)

    lines = []
    actions = []

    if can_apply:
        lines.append(f'Yes — you can apply for **{ipo.ipo_name}**.')
        if ipo.ipo_score:
            lines.append(f'IPO Score: {ipo.ipo_score}/100 | AI Rating: {ipo.ai_rating or "B+"} | GMP: ₹{ipo.gmp or 0}')
    else:
        lines.append(f'Caution — funding may be tight for **{ipo.ipo_name}**.')
        lines.append(f'Available ₹{available:,.0f} vs estimated need ₹{funding_needed:,.0f}.')

    if transfer_needed > 0:
        banks = BankAccount.query.filter_by(organization_id=org_id).order_by(
            BankAccount.available_balance.desc()
        ).all()
        src = banks[0] if banks else None
        if src:
            lines.append(f'Transfer ~₹{transfer_needed:,.0f} — consider moving funds from {src.bank_name}.')
            actions.append({'type': 'transfer', 'amount': transfer_needed, 'from_bank': src.bank_name})

    if pending_transfers:
        lines.append(f'Note: {pending_transfers} pending transfer(s) may affect available cash.')

    if apply_names:
        lines.append('Recommended investors: ' + ', '.join(apply_names) + '.')
        actions.append({'type': 'apply', 'investors': apply_names, 'ipo_id': ipo.id})

    if expected_profit:
        lines.append(f'Expected profit (est.): ₹{expected_profit:,.0f}')

    refunds = treasury['refunds']
    if refunds > 0:
        lines.append(f'Expected refunds in pipeline: ₹{refunds:,.0f}')

    return {
        'answer': '\n'.join(lines),
        'confidence': 'high' if can_apply else 'medium',
        'ipo_name': ipo.ipo_name,
        'expected_profit': expected_profit,
        'recommended_investors': apply_names,
        'transfer_needed': transfer_needed,
        'actions': actions,
        'treasury': treasury,
    }
