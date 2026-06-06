import stripe
from flask import Blueprint, request, jsonify, g, current_app

from extensions import db
from models import Organization
from auth_utils import require_auth

billing_bp = Blueprint('billing', __name__, url_prefix='/api/billing')


def _stripe_configured():
    return bool(current_app.config.get('STRIPE_SECRET_KEY'))


def _init_stripe():
    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']


@billing_bp.route('/plans', methods=['GET'])
def plans():
    return jsonify({
        'plans': [
            {
                'id': 'free',
                'name': 'Free',
                'price_inr': 0,
                'limits': current_app.config['PLAN_LIMITS']['free'],
                'features': [
                    'IPO Command Board',
                    'Up to 15 investors',
                    'Up to 10 IPOs',
                    'Bank headroom alerts',
                ],
            },
            {
                'id': 'pro',
                'name': 'Pro',
                'price_inr': 999,
                'price_label': 'Rs 999 / month',
                'limits': current_app.config['PLAN_LIMITS']['pro'],
                'features': [
                    'Unlimited investors & IPOs',
                    'Bulk allotment import',
                    'Audit trail',
                    'Priority support',
                ],
                'stripe_enabled': _stripe_configured(),
            },
        ],
    })


@billing_bp.route('/status', methods=['GET'])
@require_auth()
def billing_status():
    org = Organization.query.get(g.organization_id)
    from plan_limits import usage_for_org, get_limits
    return jsonify({
        'plan': org.plan,
        'subscription_status': org.subscription_status,
        'stripe_enabled': _stripe_configured(),
        'usage': usage_for_org(org.id),
        'limits': get_limits(org.plan),
    })


@billing_bp.route('/checkout', methods=['POST'])
@require_auth(roles=('owner', 'admin'))
def checkout():
    if not _stripe_configured():
        return jsonify({'error': 'Stripe is not configured on this server'}), 503
    if not current_app.config.get('STRIPE_PRICE_ID_PRO'):
        return jsonify({'error': 'STRIPE_PRICE_ID_PRO is not set'}), 503

    _init_stripe()
    org = Organization.query.get(g.organization_id)
    base = current_app.config['APP_BASE_URL'].rstrip('/')

    if not org.stripe_customer_id:
        customer = stripe.Customer.create(
            email=g.user_email,
            name=org.name,
            metadata={'organization_id': org.id},
        )
        org.stripe_customer_id = customer.id
        db.session.commit()

    session = stripe.checkout.Session.create(
        customer=org.stripe_customer_id,
        mode='subscription',
        line_items=[{'price': current_app.config['STRIPE_PRICE_ID_PRO'], 'quantity': 1}],
        success_url=f'{base}/?billing=success',
        cancel_url=f'{base}/?billing=cancel',
        metadata={'organization_id': str(org.id)},
    )
    return jsonify({'checkout_url': session.url, 'session_id': session.id})


@billing_bp.route('/portal', methods=['POST'])
@require_auth(roles=('owner', 'admin'))
def portal():
    if not _stripe_configured():
        return jsonify({'error': 'Stripe is not configured'}), 503
    org = Organization.query.get(g.organization_id)
    if not org.stripe_customer_id:
        return jsonify({'error': 'No billing account yet. Subscribe to Pro first.'}), 400

    _init_stripe()
    base = current_app.config['APP_BASE_URL'].rstrip('/')
    session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=f'{base}/',
    )
    return jsonify({'portal_url': session.url})


@billing_bp.route('/webhook', methods=['POST'])
def webhook():
    if not _stripe_configured():
        return jsonify({'error': 'Stripe not configured'}), 503

    payload = request.get_data()
    sig = request.headers.get('Stripe-Signature', '')
    secret = current_app.config.get('STRIPE_WEBHOOK_SECRET')

    try:
        _init_stripe()
        if secret:
            event = stripe.Webhook.construct_event(payload, sig, secret)
        else:
            import json
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    _handle_stripe_event(event)
    return jsonify({'received': True})


def _handle_stripe_event(event):
    etype = event['type']
    data = event['data']['object']

    if etype == 'checkout.session.completed':
        org_id = data.get('metadata', {}).get('organization_id')
        if org_id:
            org = Organization.query.get(int(org_id))
            if org:
                org.plan = 'pro'
                org.subscription_status = 'active'
                org.stripe_subscription_id = data.get('subscription')
                db.session.commit()

    elif etype in ('customer.subscription.updated', 'customer.subscription.created'):
        org = Organization.query.filter_by(stripe_subscription_id=data.get('id')).first()
        if not org:
            cid = data.get('customer')
            org = Organization.query.filter_by(stripe_customer_id=cid).first()
        if org:
            status = data.get('status', 'active')
            org.subscription_status = status
            if status in ('active', 'trialing'):
                org.plan = 'pro'
                org.stripe_subscription_id = data.get('id')
            elif status in ('canceled', 'unpaid', 'past_due'):
                if status == 'canceled':
                    org.plan = 'free'
            db.session.commit()

    elif etype == 'customer.subscription.deleted':
        org = Organization.query.filter_by(stripe_subscription_id=data.get('id')).first()
        if org:
            org.plan = 'free'
            org.subscription_status = 'canceled'
            org.stripe_subscription_id = None
            db.session.commit()
