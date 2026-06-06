import io
import re
from datetime import datetime

import pandas as pd
from flask import Blueprint, request, jsonify, send_file, g, current_app

from extensions import db
from models import (
    User, Organization, OrganizationMember, Investor, IPO, Application,
    BankLimit, AuditLog, UpcomingIPO,
)
from auth_utils import create_token, require_auth, require_write, _slugify
from email_service import send_verification_email
from plan_limits import check_limit, plan_limit_response
from ipo_service import (
    log_audit, parse_date, ipo_allows_apply, validate_status_change,
    bank_headroom, command_board_data, calendar_events, ipo_scorecard,
    global_search,
)
from ipo_sync import sync_live_ipos

api_bp = Blueprint('api', __name__, url_prefix='/api')
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _unique_slug(base):
    slug = _slugify(base)
    n = Organization.query.filter(Organization.slug.like(f'{slug}%')).count()
    return slug if n == 0 else f'{slug}-{n + 1}'


# ---------- Auth ----------

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    full_name = (data.get('full_name') or '').strip()
    org_name = (data.get('organization_name') or f"{full_name}'s Workspace").strip()

    if not email or not password or len(password) < 6:
        return jsonify({'error': 'Email and password (min 6 chars) required'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    require_verify = current_app.config.get('REQUIRE_EMAIL_VERIFICATION')
    user = User(email=email, full_name=full_name or email.split('@')[0])
    user.set_password(password)
    if require_verify:
        user.issue_verification_token()
    else:
        user.email_verified = True

    org = Organization(name=org_name, slug=_unique_slug(org_name))
    db.session.add(user)
    db.session.add(org)
    db.session.flush()
    db.session.add(OrganizationMember(user_id=user.id, organization_id=org.id, role='owner'))
    db.session.commit()

    if require_verify:
        send_verification_email(user)
        return jsonify({
            'requires_verification': True,
            'message': 'Account created. Check your email to verify before signing in.',
            'email': user.email,
        }), 201

    token = create_token(user.id, org.id, 'owner', user.email)
    return jsonify({
        'token': token,
        'user': user.to_dict(),
        'organization': org.to_dict(),
        'role': 'owner',
        'organizations': [{'id': org.id, 'name': org.name, 'slug': org.slug, 'role': 'owner'}],
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    user = User.query.filter_by(email=email, is_active=True).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    if current_app.config.get('REQUIRE_EMAIL_VERIFICATION') and not user.email_verified:
        return jsonify({
            'error': 'Please verify your email before signing in',
            'code': 'email_not_verified',
            'email': user.email,
        }), 403

    org_id = data.get('organization_id')
    membership = None
    if org_id:
        membership = OrganizationMember.query.filter_by(user_id=user.id, organization_id=org_id).first()
    if not membership:
        membership = OrganizationMember.query.filter_by(user_id=user.id).first()
    if not membership:
        return jsonify({'error': 'No workspace found'}), 403

    org = Organization.query.get(membership.organization_id)
    token = create_token(user.id, org.id, membership.role, user.email)
    return jsonify({
        'token': token,
        'user': user.to_dict(),
        'organization': org.to_dict(),
        'role': membership.role,
        'organizations': [
            {
                'id': m.organization.id,
                'name': m.organization.name,
                'slug': m.organization.slug,
                'role': m.role,
            }
            for m in user.memberships
        ],
    })


@auth_bp.route('/me', methods=['GET'])
@require_auth()
def me():
    user = User.query.get(g.user_id)
    org = Organization.query.get(g.organization_id)
    return jsonify({
        'user': user.to_dict() if user else None,
        'organization': org.to_dict() if org else None,
        'role': g.role,
        'organizations': [
            {'id': m.organization.id, 'name': m.organization.name, 'slug': m.organization.slug, 'role': m.role}
            for m in (user.memberships if user else [])
        ],
    })


@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    data = request.json or {}
    token = (data.get('token') or request.args.get('token') or '').strip()
    if not token:
        return jsonify({'error': 'Verification token required'}), 400
    user = User.query.filter_by(verification_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid or expired verification link'}), 400
    user.email_verified = True
    user.verification_token = None
    db.session.commit()
    return jsonify({'message': 'Email verified successfully. You can sign in now.'})


@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'If the account exists, a verification email was sent.'})
    if user.email_verified:
        return jsonify({'message': 'Email is already verified.'})
    user.issue_verification_token()
    db.session.commit()
    send_verification_email(user)
    return jsonify({'message': 'Verification email sent.'})


@auth_bp.route('/create-org', methods=['POST'])
@require_auth()
def create_org():
    """Create an additional workspace for the current user."""
    data = request.json or {}
    org_name = (data.get('name') or data.get('organization_name') or 'New Workspace').strip()
    if not org_name:
        return jsonify({'error': 'Workspace name required'}), 400
    user = User.query.get(g.user_id)
    org = Organization(name=org_name, slug=_unique_slug(org_name))
    db.session.add(org)
    db.session.flush()
    db.session.add(OrganizationMember(user_id=user.id, organization_id=org.id, role='owner'))
    db.session.commit()
    token = create_token(user.id, org.id, 'owner', user.email)
    memberships = OrganizationMember.query.filter_by(user_id=user.id).all()
    return jsonify({
        'token': token,
        'user': user.to_dict(),
        'organization': org.to_dict(),
        'role': 'owner',
        'organizations': [
            {'id': m.organization.id, 'name': m.organization.name, 'slug': m.organization.slug, 'role': m.role}
            for m in memberships
        ],
    }), 201


@auth_bp.route('/switch-org', methods=['POST'])
@require_auth()
def switch_org():
    data = request.json or {}
    org_id = data.get('organization_id')
    membership = OrganizationMember.query.filter_by(user_id=g.user_id, organization_id=org_id).first()
    if not membership:
        return jsonify({'error': 'Not a member of this workspace'}), 403
    user = User.query.get(g.user_id)
    token = create_token(user.id, org_id, membership.role, user.email)
    org = Organization.query.get(org_id)
    return jsonify({'token': token, 'organization': org.to_dict(), 'role': membership.role})


# ---------- IPO Control ----------

@api_bp.route('/command-board', methods=['GET'])
@require_auth()
def command_board():
    return jsonify(command_board_data(g.organization_id))


@api_bp.route('/calendar', methods=['GET'])
@require_auth()
def calendar():
    return jsonify(calendar_events(g.organization_id))


@api_bp.route('/search', methods=['GET'])
@require_auth()
def search():
    return jsonify(global_search(g.organization_id, request.args.get('q', '')))


@api_bp.route('/scorecard', methods=['GET'])
@require_auth()
def scorecard():
    return jsonify(ipo_scorecard(g.organization_id))


@api_bp.route('/upcoming-ipos', methods=['GET'])
@require_auth()
def upcoming_ipos():
    status_filter = request.args.get('status')
    q = UpcomingIPO.query.filter_by(is_active=True)
    if status_filter:
        q = q.filter_by(ipo_status=status_filter)
    rows = q.order_by(UpcomingIPO.ipo_status, UpcomingIPO.bidding_close).all()
    last_sync = db.session.query(db.func.max(UpcomingIPO.last_synced_at)).scalar()
    return jsonify({
        'ipos': [u.to_dict() for u in rows],
        'count': len(rows),
        'last_synced_at': last_sync.isoformat() if last_sync else None,
    })


@api_bp.route('/upcoming-ipos/fetch-live', methods=['POST'])
@require_write
def fetch_live_ipos():
    """Pull latest IPO list from Moneycontrol and other sources."""
    try:
        result = sync_live_ipos()
        return jsonify({
            'message': f"Synced {result['fetched']} IPOs ({result['created']} new, {result['updated']} updated)",
            **result,
        })
    except Exception as exc:
        return jsonify({'error': f'Live fetch failed: {exc}'}), 500


@api_bp.route('/upcoming-ipos/<int:uid>/import', methods=['POST'])
@require_write
def import_upcoming(uid):
    u = UpcomingIPO.query.get_or_404(uid)
    price = u.price_band_high or u.price_band_low or 0
    lot = u.lot_size or 1
    is_open = (u.ipo_status or 'upcoming') == 'open'
    from ipo_enrich_service import enrich_ipo
    ipo = IPO(
        organization_id=g.organization_id,
        ipo_name=u.ipo_name,
        ipo_type=u.ipo_type,
        status='Open' if is_open else 'Closed',
        lifecycle_stage='Open' if is_open else 'Upcoming',
        ipo_date=u.bidding_open,
        bidding_close_date=u.bidding_close,
        allotment_date=u.allotment_date,
        listing_date=u.listing_date,
        num_shares=lot,
        lot_size=lot,
        purchase_price_per_share=price,
        price_band_low=u.price_band_low,
        price_band_high=u.price_band_high,
        subscription_times=u.total_subscription,
    )
    enrich_ipo(ipo, organization_id=g.organization_id)
    db.session.add(ipo)
    db.session.commit()
    return jsonify({
        'message': f"IPO imported with score {ipo.ipo_score}, GMP ₹{ipo.gmp}",
        'ipo': ipo.to_dict(),
    }), 201


# ---------- Investors ----------

@api_bp.route('/investors', methods=['GET'])
@require_auth()
def list_investors():
    rows = Investor.query.filter_by(organization_id=g.organization_id).all()
    return jsonify([i.to_dict() if hasattr(i, 'to_dict') else {
        'id': i.id, 'name': i.name, 'upi': i.upi,
        'family_group': i.family_group, 'banks': i.banks,
    } for i in rows])


@api_bp.route('/investors', methods=['POST'])
@require_write
def add_investor():
    org = Organization.query.get(g.organization_id)
    ok, err, meta = check_limit(org, 'investors')
    if not ok:
        return plan_limit_response(err, meta)
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
    db.session.commit()
    return jsonify({'message': 'Investor added', 'id': inv.id}), 201


@api_bp.route('/investors/<int:id>', methods=['PUT'])
@require_write
def update_investor(id):
    inv = Investor.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    for field in ['name', 'pan', 'demat_account', 'broker', 'upi', 'family_group',
                  'relationship', 'priority_rank', 'risk_category', 'profit_sharing_pct',
                  'is_active', 'banks']:
        if field in data:
            setattr(inv, field, data[field])
    db.session.commit()
    return jsonify({'message': 'Updated'})


@api_bp.route('/investors/<int:id>', methods=['DELETE'])
@require_write
def delete_investor(id):
    inv = Investor.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    db.session.delete(inv)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@api_bp.route('/investors/template', methods=['GET'])
@require_auth()
def investor_template():
    df = pd.DataFrame(columns=['Name', 'UPI ID', 'Family Group', 'Banks'])
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name='investor_template.xlsx')


@api_bp.route('/investors/import', methods=['POST'])
@require_write
def import_investors():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    df = pd.read_excel(file)
    if 'Name' not in df.columns:
        return jsonify({'error': 'Missing Name column'}), 400
    count = 0
    for _, row in df.iterrows():
        name = str(row['Name']).strip()
        if not name:
            continue
        exists = Investor.query.filter_by(organization_id=g.organization_id, name=name).first()
        if not exists:
            db.session.add(Investor(
                organization_id=g.organization_id,
                name=name,
                upi=str(row.get('UPI ID', '') or ''),
                family_group=str(row.get('Family Group', 'Other') or 'Other'),
                banks=str(row.get('Banks', '') or ''),
            ))
            count += 1
    db.session.commit()
    return jsonify({'message': f'Imported {count} investors'})


# ---------- IPOs ----------

def _ipo_payload(data, ipo=None):
    fields = {}
    name = data.get('ipo_name') or data.get('name')
    if name:
        fields['ipo_name'] = name
    for key, attr in [
        ('ipo_type', 'ipo_type'), ('type', 'ipo_type'),
        ('status', 'status'), ('lifecycle_stage', 'lifecycle_stage'),
        ('num_shares', 'num_shares'), ('shares', 'num_shares'),
        ('lot_size', 'lot_size'),
        ('purchase_price_per_share', 'purchase_price_per_share'),
        ('price', 'purchase_price_per_share'),
        ('sale_price_per_share', 'sale_price_per_share'),
        ('sell_price', 'sale_price_per_share'),
        ('price_band_low', 'price_band_low'),
        ('price_band_high', 'price_band_high'),
        ('gmp', 'gmp'), ('ipo_score', 'ipo_score'), ('ai_rating', 'ai_rating'),
        ('risk_rating', 'risk_rating'), ('subscription_times', 'subscription_times'),
        ('expected_listing_gain', 'expected_listing_gain'),
        ('funding_requirement', 'funding_requirement'),
    ]:
        if key in data and data[key] is not None and data[key] != '':
            fields[attr] = data[key]
    for date_key, attr in [
        ('ipo_date', 'ipo_date'), ('bidding_close_date', 'bidding_close_date'),
        ('allotment_date', 'allotment_date'), ('listing_date', 'listing_date'),
    ]:
        if data.get(date_key):
            fields[attr] = parse_date(data[date_key])
    return fields


@api_bp.route('/ipos', methods=['GET'])
@require_auth()
def list_ipos():
    rows = IPO.query.filter_by(organization_id=g.organization_id).all()
    return jsonify([i.to_dict() for i in rows])


@api_bp.route('/ipos', methods=['POST'])
@require_write
def add_ipo():
    org = Organization.query.get(g.organization_id)
    ok, err, meta = check_limit(org, 'ipos')
    if not ok:
        return plan_limit_response(err, meta)
    data = request.json or {}
    fields = _ipo_payload(data)
    if not fields.get('ipo_name'):
        return jsonify({'error': 'IPO name required'}), 400
    if not fields.get('num_shares') or not fields.get('purchase_price_per_share'):
        return jsonify({'error': 'Shares and purchase price required'}), 400
    ipo = IPO(organization_id=g.organization_id, **fields)
    if not ipo.lifecycle_stage:
        ipo.lifecycle_stage = 'Open' if ipo.status == 'Open' else 'Upcoming'
    db.session.add(ipo)
    db.session.commit()
    return jsonify({'message': 'IPO added', 'ipo': ipo.to_dict()}), 201


@api_bp.route('/ipos/<int:id>', methods=['PUT'])
@require_write
def update_ipo(id):
    ipo = IPO.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    fields = _ipo_payload(request.json or {})
    for k, v in fields.items():
        setattr(ipo, k, v)
    db.session.commit()
    return jsonify({'message': 'Updated', 'ipo': ipo.to_dict()})


@api_bp.route('/ipos/<int:id>', methods=['DELETE'])
@require_write
def delete_ipo(id):
    ipo = IPO.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    db.session.delete(ipo)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# ---------- Applications ----------

@api_bp.route('/applications', methods=['GET'])
@require_auth()
def list_applications():
    apps = Application.query.filter_by(organization_id=g.organization_id).all()
    return jsonify([a.to_dict() for a in apps])


@api_bp.route('/applications', methods=['POST'])
@require_write
def add_application():
    data = request.json or {}
    ipo = IPO.query.filter_by(id=data['ipo_id'], organization_id=g.organization_id).first_or_404()
    ok, err = ipo_allows_apply(ipo)
    if not ok:
        return jsonify({'error': err}), 400

    existing = Application.query.filter_by(
        organization_id=g.organization_id,
        investor_id=data['investor_id'],
        ipo_id=data['ipo_id'],
    ).first()
    if existing:
        return jsonify({'error': 'Application already exists for this investor and IPO'}), 409

    amount = float(data.get('application_amount') or 0)
    bank = data.get('bank_name') or ''
    if bank:
        ok_b, err_b, _, _ = bank_headroom(g.organization_id, bank, amount)
        if not ok_b:
            return jsonify({'error': err_b}), 400

    app = Application(
        organization_id=g.organization_id,
        investor_id=data['investor_id'],
        ipo_id=data['ipo_id'],
        application_amount=amount,
        status=data.get('status', 'Applied'),
        payment_status=data.get('payment_status', 'Pending'),
        bank_name=bank or None,
        sell_price=data.get('sell_price'),
        application_ref=data.get('application_ref'),
        apply_channel=data.get('apply_channel', 'ASBA'),
        allotted_shares=data.get('allotted_shares'),
    )
    db.session.add(app)
    db.session.commit()
    log_audit(g.organization_id, g.user_id, 'application', app.id, 'create', None, app.status)
    db.session.commit()
    return jsonify({'message': 'Application created', 'id': app.id}), 201


@api_bp.route('/applications/<int:id>', methods=['PUT'])
@require_write
def update_application(id):
    app = Application.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    ipo = app.ipo

    for field in ('status', 'payment_status', 'bank_name', 'sell_price', 'application_ref',
                  'apply_channel', 'allotted_shares', 'application_amount'):
        if field not in data:
            continue
        old = getattr(app, field)
        new = data[field]
        if field == 'allotted_shares' and new is not None:
            new = int(new)
        if field == 'status':
            ok, err = validate_status_change(ipo, new)
            if not ok:
                return jsonify({'error': err}), 400
            if new == 'Allotted' and not app.allotted_at:
                app.allotted_at = datetime.utcnow()
        if field == 'bank_name' and new and app.application_amount:
            ok_b, err_b, _, _ = bank_headroom(g.organization_id, new, 0)
            if not ok_b and app.status == 'Applied':
                return jsonify({'error': err_b}), 400
        log_audit(g.organization_id, g.user_id, 'application', app.id, field, old, new)
        setattr(app, field, new)

    db.session.commit()
    return jsonify({'message': 'Updated', 'application': app.to_dict()})


@api_bp.route('/applications/<int:id>', methods=['DELETE'])
@require_write
def delete_application(id):
    app = Application.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    db.session.delete(app)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@api_bp.route('/applications/bulk-status', methods=['POST'])
@require_write
def bulk_status():
    data = request.json or {}
    ipo_id = data.get('ipo_id')
    status = data.get('status')
    investor_ids = data.get('investor_ids')

    if status not in ('Allotted', 'Not Allotted', 'Applied'):
        return jsonify({'error': 'Invalid status'}), 400

    q = Application.query.filter_by(organization_id=g.organization_id, ipo_id=ipo_id)
    if investor_ids:
        q = q.filter(Application.investor_id.in_(investor_ids))
    apps = q.all()
    ipo = IPO.query.get(ipo_id)
    updated = 0
    for app in apps:
        ok, err = validate_status_change(ipo, status)
        if not ok:
            continue
        log_audit(g.organization_id, g.user_id, 'application', app.id, 'status', app.status, status)
        app.status = status
        if status == 'Allotted':
            app.allotted_at = datetime.utcnow()
        updated += 1
    db.session.commit()
    return jsonify({'message': f'Updated {updated} applications'})


@api_bp.route('/applications/bulk-import', methods=['POST'])
@require_write
def bulk_import_results():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    ipo_id = request.form.get('ipo_id', type=int)
    if not ipo_id:
        return jsonify({'error': 'ipo_id required'}), 400
    ipo = IPO.query.filter_by(id=ipo_id, organization_id=g.organization_id).first_or_404()
    df = pd.read_excel(request.files['file'])
    required = {'Investor Name', 'Status'}
    if not required.issubset(df.columns):
        return jsonify({'error': 'Columns required: Investor Name, Status'}), 400

    updated, created = 0, 0
    for _, row in df.iterrows():
        name = str(row['Investor Name']).strip()
        status = str(row['Status']).strip()
        if status not in ('Allotted', 'Not Allotted', 'Applied'):
            continue
        inv = Investor.query.filter_by(organization_id=g.organization_id, name=name).first()
        if not inv:
            continue
        app = Application.query.filter_by(
            organization_id=g.organization_id, investor_id=inv.id, ipo_id=ipo_id
        ).first()
        allotted_shares = row.get('Allotted Shares')
        if pd.notna(allotted_shares):
            allotted_shares = int(allotted_shares)
        else:
            allotted_shares = None

        if app:
            app.status = status
            if allotted_shares is not None:
                app.allotted_shares = allotted_shares
            if status == 'Allotted':
                app.allotted_at = datetime.utcnow()
            updated += 1
        else:
            amount = (ipo.num_shares or 0) * (ipo.purchase_price_per_share or 0)
            db.session.add(Application(
                organization_id=g.organization_id,
                investor_id=inv.id,
                ipo_id=ipo_id,
                application_amount=amount,
                status=status,
                payment_status='Pending',
                allotted_shares=allotted_shares,
                allotted_at=datetime.utcnow() if status == 'Allotted' else None,
            ))
            created += 1
    db.session.commit()
    return jsonify({'message': f'Updated {updated}, created {created}'})


@api_bp.route('/applications/listing-day', methods=['POST'])
@require_write
def listing_day_bulk():
    data = request.json or {}
    ipo_id = data.get('ipo_id')
    sell_price = data.get('sell_price')
    payment_status = data.get('payment_status', 'Received')
    apps = Application.query.filter_by(
        organization_id=g.organization_id, ipo_id=ipo_id, status='Allotted'
    ).all()
    for app in apps:
        if sell_price is not None:
            app.sell_price = float(sell_price)
        app.payment_status = payment_status
    ipo = IPO.query.get(ipo_id)
    if ipo and sell_price is not None:
        ipo.sale_price_per_share = float(sell_price)
        ipo.lifecycle_stage = 'Listed'
    db.session.commit()
    return jsonify({'message': f'Updated {len(apps)} allotted applications'})


@api_bp.route('/applications/export', methods=['GET'])
@require_auth()
def export_applications():
    ipo_id = request.args.get('ipo_id', type=int)
    q = Application.query.filter_by(organization_id=g.organization_id)
    if ipo_id:
        q = q.filter_by(ipo_id=ipo_id)
    apps = q.all()
    rows = []
    for a in apps:
        rows.append({
            'IPO': a.ipo.ipo_name if a.ipo else '',
            'Investor': a.investor.name if a.investor else '',
            'Application Ref': a.application_ref or '',
            'Channel': a.apply_channel or '',
            'Amount': a.application_amount,
            'Bank': a.bank_name or '',
            'Status': a.status,
            'Payment': a.payment_status,
            'Allotted Shares': a.allotted_shares or '',
            'Sell Price': a.sell_price or '',
            'Profit': a.profit,
        })
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)
    return send_file(
        buf,
        as_attachment=True,
        download_name='ipo_applications.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


# ---------- Bank limits ----------

@api_bp.route('/bank-limits', methods=['GET'])
@require_auth()
def list_bank_limits():
    limits = BankLimit.query.filter_by(organization_id=g.organization_id).all()
    result = []
    for bl in limits:
        ok, _, blocked, cap = bank_headroom(g.organization_id, bl.bank_name, 0)
        result.append({
            'id': bl.id,
            'bank_name': bl.bank_name,
            'max_blocked_amount': bl.max_blocked_amount,
            'current_blocked': round(blocked, 2),
            'remaining': round((cap or 0) - blocked, 2) if cap else None,
        })
    return jsonify(result)


@api_bp.route('/bank-limits', methods=['POST'])
@require_write
def set_bank_limit():
    data = request.json or {}
    bank = data.get('bank_name', '').strip()
    cap = float(data.get('max_blocked_amount', 0))
    if not bank:
        return jsonify({'error': 'bank_name required'}), 400
    bl = BankLimit.query.filter_by(organization_id=g.organization_id, bank_name=bank).first()
    if bl:
        bl.max_blocked_amount = cap
    else:
        db.session.add(BankLimit(organization_id=g.organization_id, bank_name=bank, max_blocked_amount=cap))
    db.session.commit()
    return jsonify({'message': 'Bank limit saved'})


@api_bp.route('/bank-limits/<int:id>', methods=['DELETE'])
@require_write
def delete_bank_limit(id):
    bl = BankLimit.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    db.session.delete(bl)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# ---------- Reports (tenant-scoped) ----------

@api_bp.route('/reports/bank-stats', methods=['GET'])
@require_auth()
def bank_stats():
    org = g.organization_id
    blocked_q = db.session.query(
        Application.bank_name,
        db.func.sum(Application.application_amount),
        db.func.count(Application.id),
    ).filter(
        Application.organization_id == org,
        Application.status == 'Applied',
        Application.bank_name.isnot(None),
        Application.bank_name != '',
    ).group_by(Application.bank_name).all()

    invested_q = db.session.query(
        Application.bank_name,
        db.func.sum(Application.application_amount),
        db.func.count(Application.id),
    ).filter(
        Application.organization_id == org,
        Application.status == 'Allotted',
        Application.bank_name.isnot(None),
        Application.bank_name != '',
    ).group_by(Application.bank_name).all()

    stats = {}
    for bank, total, cnt in blocked_q:
        stats.setdefault(bank, {'blocked': 0, 'invested': 0, 'blocked_count': 0, 'invested_count': 0})
        stats[bank]['blocked'] = total
        stats[bank]['blocked_count'] = cnt
    for bank, total, cnt in invested_q:
        stats.setdefault(bank, {'blocked': 0, 'invested': 0, 'blocked_count': 0, 'invested_count': 0})
        stats[bank]['invested'] = total
        stats[bank]['invested_count'] = cnt

    limits = {b.bank_name: b.max_blocked_amount for b in BankLimit.query.filter_by(organization_id=org).all()}
    result = []
    for bank, d in stats.items():
        cap = limits.get(bank)
        result.append({
            'bank_name': bank,
            'blocked_amount': round(d['blocked'] or 0, 2),
            'invested_amount': round(d['invested'] or 0, 2),
            'blocked_count': d['blocked_count'],
            'invested_count': d['invested_count'],
            'max_blocked_amount': cap,
            'remaining_headroom': round(cap - (d['blocked'] or 0), 2) if cap else None,
        })
    result.sort(key=lambda x: x['blocked_amount'], reverse=True)
    return jsonify(result)


@api_bp.route('/reports/ipo-profit', methods=['GET'])
@require_auth()
def ipo_profit():
    summary = []
    for ipo in IPO.query.filter_by(organization_id=g.organization_id).all():
        apps = Application.query.filter_by(organization_id=g.organization_id, ipo_id=ipo.id, status='Allotted').all()
        summary.append({
            'ipo_name': ipo.ipo_name,
            'profit': round(sum(a.profit for a in apps), 2),
            'allotted_count': len(apps),
        })
    summary.sort(key=lambda x: x['profit'], reverse=True)
    return jsonify(summary)


@api_bp.route('/dashboard/summary', methods=['GET'])
@require_auth()
def dashboard_summary():
    org = g.organization_id
    total_applications = Application.query.filter_by(organization_id=org).count()
    total_allotted = Application.query.filter_by(organization_id=org, status='Allotted').count()
    total_not_allotted = Application.query.filter_by(organization_id=org, status='Not Allotted').count()
    total_applied = Application.query.filter_by(organization_id=org, status='Applied').count()
    allotted_apps = Application.query.filter_by(organization_id=org, status='Allotted').all()
    total_profit = sum(a.profit for a in allotted_apps)
    total_invested = sum(a.application_amount or 0 for a in allotted_apps)
    money_received = Application.query.filter_by(organization_id=org, status='Allotted', payment_status='Received').count()
    money_pending = Application.query.filter_by(organization_id=org, status='Allotted', payment_status='Pending').count()
    applied_apps = Application.query.filter_by(organization_id=org, status='Applied').all()
    amount_blocked = sum(a.application_amount or 0 for a in applied_apps)

    return jsonify({
        'total_applications': total_applications,
        'total_allotted': total_allotted,
        'total_not_allotted': total_not_allotted,
        'total_applied': total_applied,
        'total_profit': round(total_profit, 2),
        'total_invested': round(total_invested, 2),
        'money_received': money_received,
        'money_pending': money_pending,
        'amount_blocked': round(amount_blocked, 2),
        'bank_balance_required': round(amount_blocked, 2),
        'further_amount_required': round(amount_blocked, 2),
        'total_sale_value': 0,
    })


@api_bp.route('/reports/funding-summary', methods=['GET'])
@require_auth()
def funding_summary():
    return jsonify({
        'funding_breakdown': [],
        'borrowed_amount_pending_repayment': 0,
        'money_lent_pending_return': 0,
        'borrowed_applications_count': 0,
        'pending_transfers_count': 0,
    })


@api_bp.route('/audit-logs', methods=['GET'])
@require_auth()
def audit_logs():
    logs = AuditLog.query.filter_by(organization_id=g.organization_id).order_by(AuditLog.created_at.desc()).limit(200).all()
    return jsonify([{
        'id': l.id,
        'entity_type': l.entity_type,
        'entity_id': l.entity_id,
        'field_name': l.field_name,
        'old_value': l.old_value,
        'new_value': l.new_value,
        'created_at': l.created_at.isoformat() if l.created_at else None,
    } for l in logs])


# Money transfers — compatibility shim for Transfer model
@api_bp.route('/money-transfers', methods=['GET'])
@require_auth()
def money_transfers_list():
    from models import Transfer
    rows = Transfer.query.filter_by(organization_id=g.organization_id).all()
    return jsonify([{
        'id': t.id,
        'from_person': t.from_person,
        'to_person': t.to_person,
        'amount': t.amount,
        'purpose': t.purpose,
        'transfer_date': t.transfer_date.isoformat() if t.transfer_date else None,
        'repayment_status': t.status,
        'notes': t.notes,
    } for t in rows])


@api_bp.route('/money-transfers', methods=['POST'])
@require_write
def money_transfers_create():
    from models import Transfer
    from datetime import date
    data = request.json or {}
    t = Transfer(
        organization_id=g.organization_id,
        from_person=data.get('from_person', 'You'),
        to_person=data.get('to_person', data.get('to_person_name', '')),
        amount=float(data.get('amount', 0)),
        purpose=data.get('purpose'),
        status=data.get('repayment_status', data.get('status', 'Pending')),
        transfer_date=date.today(),
        notes=data.get('notes'),
    )
    db.session.add(t)
    db.session.commit()
    return jsonify({'message': 'Transfer recorded', 'id': t.id}), 201


@api_bp.route('/money-transfers/<int:id>', methods=['PUT'])
@require_write
def money_transfers_update(id):
    from models import Transfer
    t = Transfer.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    data = request.json or {}
    for field in ['from_person', 'to_person', 'amount', 'purpose', 'notes']:
        if field in data:
            setattr(t, field, data[field] if field != 'amount' else float(data[field]))
    if 'repayment_status' in data or 'status' in data:
        t.status = data.get('status', data.get('repayment_status', t.status))
    db.session.commit()
    return jsonify({'message': 'Updated'})


@api_bp.route('/money-transfers/<int:id>', methods=['DELETE'])
@require_write
def money_transfers_delete(id):
    from models import Transfer
    t = Transfer.query.filter_by(id=id, organization_id=g.organization_id).first_or_404()
    db.session.delete(t)
    db.session.commit()
    return jsonify({'message': 'Deleted'})
