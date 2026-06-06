import secrets
from datetime import datetime, date
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(200), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    email_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(64), unique=True, nullable=True, index=True)
    verification_sent_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    memberships = db.relationship('OrganizationMember', back_populates='user', cascade='all, delete-orphan')

    def issue_verification_token(self):
        self.verification_token = secrets.token_urlsafe(32)
        self.verification_sent_at = datetime.utcnow()
        self.email_verified = False

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'email_verified': self.email_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Organization(db.Model):
    __tablename__ = 'organizations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    plan = db.Column(db.String(50), default='free')  # free, pro
    subscription_status = db.Column(db.String(50), default='none')  # none, active, past_due, canceled
    stripe_customer_id = db.Column(db.String(100), nullable=True, index=True)
    stripe_subscription_id = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    members = db.relationship('OrganizationMember', back_populates='organization', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'plan': self.plan,
            'subscription_status': self.subscription_status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class OrganizationMember(db.Model):
    __tablename__ = 'organization_members'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    role = db.Column(db.String(50), default='owner')  # owner, admin, member, viewer
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='memberships')
    organization = db.relationship('Organization', back_populates='members')

    __table_args__ = (db.UniqueConstraint('user_id', 'organization_id', name='uq_user_org'),)


class Investor(db.Model):
    __tablename__ = 'investors'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    pan = db.Column(db.String(20))
    demat_account = db.Column(db.String(50))
    broker = db.Column(db.String(100))
    upi = db.Column(db.String(100))
    family_group = db.Column(db.String(50))
    relationship = db.Column(db.String(50))
    priority_rank = db.Column(db.Integer, default=99)
    risk_category = db.Column(db.String(20), default='Medium')
    profit_sharing_pct = db.Column(db.Float, default=0)
    is_active = db.Column(db.Boolean, default=True)
    banks = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    organization = db.relationship('Organization', backref=db.backref('investors', lazy=True))
    applications = db.relationship('Application', back_populates='investor', cascade='all, delete-orphan')
    contacts = db.relationship('InvestorContact', back_populates='investor', cascade='all, delete-orphan')
    bank_links = db.relationship('BankInvestorLink', back_populates='investor', cascade='all, delete-orphan')
    broker_connections = db.relationship('BrokerConnection', back_populates='investor', cascade='all, delete-orphan')
    holdings = db.relationship('Holding', back_populates='investor', cascade='all, delete-orphan')

    def to_dict(self, include_metrics=False):
        d = {
            'id': self.id,
            'name': self.name,
            'pan': self.pan,
            'demat_account': self.demat_account,
            'broker': self.broker,
            'upi': self.upi,
            'family_group': self.family_group,
            'relationship': self.relationship,
            'priority_rank': self.priority_rank,
            'risk_category': self.risk_category,
            'profit_sharing_pct': self.profit_sharing_pct,
            'is_active': self.is_active,
            'banks': self.banks,
            'contacts': [c.to_dict() for c in self.contacts] if self.contacts else [],
        }
        if include_metrics:
            apps = self.applications or []
            allotted = [a for a in apps if a.status == 'Allotted']
            d['metrics'] = {
                'total_applications': len(apps),
                'allotment_pct': round(len(allotted) / len(apps) * 100, 1) if apps else 0,
                'total_profit': round(sum(a.profit for a in allotted), 2),
                'success_ratio': round(len(allotted) / len(apps) * 100, 1) if apps else 0,
                'holdings_value': round(sum(h.market_value for h in (self.holdings or [])), 2),
            }
        return d


class InvestorContact(db.Model):
    __tablename__ = 'investor_contacts'

    id = db.Column(db.Integer, primary_key=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=False, index=True)
    contact_type = db.Column(db.String(30), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    notes = db.Column(db.String(200))

    investor = db.relationship('Investor', back_populates='contacts')

    def to_dict(self):
        return {
            'id': self.id,
            'contact_type': self.contact_type,
            'name': self.name,
            'phone': self.phone,
            'notes': self.notes,
        }


class IPO(db.Model):
    __tablename__ = 'ipos'

    LIFECYCLE_STAGES = (
        'Upcoming', 'Open', 'BiddingClosed', 'AwaitingAllotment', 'Listed', 'Closed'
    )

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    ipo_name = db.Column(db.String(200), nullable=False)
    ipo_type = db.Column(db.String(50), default='Mainboard')
    status = db.Column(db.String(50), default='Open')
    lifecycle_stage = db.Column(db.String(50), default='Open')
    ipo_date = db.Column(db.Date)
    bidding_close_date = db.Column(db.Date)
    allotment_date = db.Column(db.Date)
    listing_date = db.Column(db.Date)
    num_shares = db.Column(db.Integer)
    lot_size = db.Column(db.Integer)
    purchase_price_per_share = db.Column(db.Float)
    sale_price_per_share = db.Column(db.Float, nullable=True)
    price_band_low = db.Column(db.Float, nullable=True)
    price_band_high = db.Column(db.Float, nullable=True)
    gmp = db.Column(db.Float, nullable=True)
    ipo_score = db.Column(db.Float, nullable=True)
    ai_rating = db.Column(db.String(10), nullable=True)
    risk_rating = db.Column(db.String(10), nullable=True)
    subscription_times = db.Column(db.Float, nullable=True)
    expected_listing_gain = db.Column(db.Float, nullable=True)
    funding_requirement = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    organization = db.relationship('Organization', backref=db.backref('ipos', lazy=True))
    applications = db.relationship('Application', back_populates='ipo', cascade='all, delete-orphan')

    @property
    def total_investment(self):
        if self.num_shares and self.purchase_price_per_share:
            return self.num_shares * self.purchase_price_per_share
        return 0

    def to_dict(self):
        return {
            'id': self.id,
            'ipo_name': self.ipo_name,
            'ipo_type': self.ipo_type,
            'status': self.status,
            'lifecycle_stage': self.lifecycle_stage,
            'ipo_date': self.ipo_date.isoformat() if self.ipo_date else None,
            'bidding_close_date': self.bidding_close_date.isoformat() if self.bidding_close_date else None,
            'allotment_date': self.allotment_date.isoformat() if self.allotment_date else None,
            'listing_date': self.listing_date.isoformat() if self.listing_date else None,
            'num_shares': self.num_shares,
            'lot_size': self.lot_size,
            'purchase_price_per_share': self.purchase_price_per_share,
            'sale_price_per_share': self.sale_price_per_share,
            'price_band_low': self.price_band_low,
            'price_band_high': self.price_band_high,
            'gmp': self.gmp,
            'ipo_score': self.ipo_score,
            'ai_rating': self.ai_rating,
            'risk_rating': self.risk_rating,
            'subscription_times': self.subscription_times,
            'expected_listing_gain': self.expected_listing_gain,
            'funding_requirement': self.funding_requirement,
            'profit': self.profit,
        }

    @property
    def profit(self):
        if self.sale_price_per_share and self.num_shares and self.purchase_price_per_share:
            return (self.sale_price_per_share - self.purchase_price_per_share) * self.num_shares
        return 0


class Application(db.Model):
    __tablename__ = 'applications'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=False)
    ipo_id = db.Column(db.Integer, db.ForeignKey('ipos.id'), nullable=False)
    application_amount = db.Column(db.Float)
    status = db.Column(db.String(50), default='Applied')
    kanban_stage = db.Column(db.String(50), default='Applied')
    payment_status = db.Column(db.String(50), default='Pending')
    bank_name = db.Column(db.String(100))
    sell_price = db.Column(db.Float, nullable=True)
    application_ref = db.Column(db.String(100))
    apply_channel = db.Column(db.String(50), default='ASBA')  # ASBA, UPI, NetBanking
    allotted_shares = db.Column(db.Integer, nullable=True)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    allotted_at = db.Column(db.DateTime, nullable=True)
    registrar_check_status = db.Column(db.String(50), nullable=True)
    registrar_checked_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = db.relationship('Organization', backref=db.backref('applications', lazy=True))
    investor = db.relationship('Investor', back_populates='applications')
    ipo = db.relationship('IPO', back_populates='applications')

    __table_args__ = (
        db.UniqueConstraint('organization_id', 'investor_id', 'ipo_id', name='uq_org_investor_ipo'),
    )

    def shares_for_profit(self):
        if self.allotted_shares is not None:
            return self.allotted_shares
        if self.ipo and self.ipo.num_shares:
            return self.ipo.num_shares
        return 0

    @property
    def profit(self):
        if self.status != 'Allotted' or not self.ipo:
            return 0
        shares = self.shares_for_profit()
        sell = self.sell_price if self.sell_price is not None else self.ipo.sale_price_per_share
        buy = self.ipo.purchase_price_per_share or 0
        if sell and shares:
            return round((sell - buy) * shares, 2)
        return 0

    def to_dict(self, include_names=True):
        d = {
            'id': self.id,
            'investor_id': self.investor_id,
            'ipo_id': self.ipo_id,
            'application_amount': self.application_amount,
            'status': self.status,
            'kanban_stage': self.kanban_stage or self.status,
            'payment_status': self.payment_status,
            'bank_name': self.bank_name,
            'sell_price': self.sell_price,
            'application_ref': self.application_ref,
            'apply_channel': self.apply_channel,
            'allotted_shares': self.allotted_shares,
            'profit': self.profit,
            'applied_at': self.applied_at.isoformat() if self.applied_at else None,
            'allotted_at': self.allotted_at.isoformat() if self.allotted_at else None,
            'registrar_check_status': self.registrar_check_status,
            'registrar_checked_at': self.registrar_checked_at.isoformat() if self.registrar_checked_at else None,
        }
        if include_names:
            d['investor_name'] = self.investor.name if self.investor else None
            d['ipo_name'] = self.ipo.ipo_name if self.ipo else None
            d['family_group'] = self.investor.family_group if self.investor else None
        return d


class BankLimit(db.Model):
    __tablename__ = 'bank_limits'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    bank_name = db.Column(db.String(100), nullable=False)
    max_blocked_amount = db.Column(db.Float, nullable=False, default=0)

    __table_args__ = (
        db.UniqueConstraint('organization_id', 'bank_name', name='uq_org_bank'),
    )


class BankAccount(db.Model):
    __tablename__ = 'bank_accounts'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    bank_name = db.Column(db.String(100), nullable=False)
    account_number = db.Column(db.String(50))
    current_balance = db.Column(db.Float, default=0)
    available_balance = db.Column(db.Float, default=0)
    blocked_balance = db.Column(db.Float, default=0)
    asba_limit = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    investor_links = db.relationship('BankInvestorLink', back_populates='bank_account', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'bank_name': self.bank_name,
            'account_number': self.account_number,
            'current_balance': self.current_balance or 0,
            'available_balance': self.available_balance or 0,
            'blocked_balance': self.blocked_balance or 0,
            'asba_limit': self.asba_limit or 0,
            'linked_investors': [l.investor.name for l in self.investor_links if l.investor],
        }


class BankInvestorLink(db.Model):
    __tablename__ = 'bank_investor_links'

    id = db.Column(db.Integer, primary_key=True)
    bank_account_id = db.Column(db.Integer, db.ForeignKey('bank_accounts.id'), nullable=False)
    investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=False)

    bank_account = db.relationship('BankAccount', back_populates='investor_links')
    investor = db.relationship('Investor', back_populates='bank_links')

    __table_args__ = (db.UniqueConstraint('bank_account_id', 'investor_id', name='uq_bank_investor'),)


class Transfer(db.Model):
    __tablename__ = 'transfers'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    from_investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=True)
    to_investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=True)
    from_person = db.Column(db.String(100), nullable=False)
    to_person = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    purpose = db.Column(db.String(200))
    ipo_id = db.Column(db.Integer, db.ForeignKey('ipos.id'), nullable=True)
    status = db.Column(db.String(30), default='Pending')
    transfer_date = db.Column(db.Date, default=date.today)
    settlement_due_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    ipo = db.relationship('IPO', backref='transfers')

    def to_dict(self):
        return {
            'id': self.id,
            'from_investor_id': self.from_investor_id,
            'to_investor_id': self.to_investor_id,
            'from_person': self.from_person,
            'to_person': self.to_person,
            'amount': self.amount,
            'purpose': self.purpose,
            'ipo_id': self.ipo_id,
            'ipo_name': self.ipo.ipo_name if self.ipo else None,
            'status': self.status,
            'transfer_date': self.transfer_date.isoformat() if self.transfer_date else None,
            'settlement_due_date': self.settlement_due_date.isoformat() if self.settlement_due_date else None,
            'notes': self.notes,
        }


class BrokerConnection(db.Model):
    __tablename__ = 'broker_connections'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=False)
    broker_name = db.Column(db.String(50), nullable=False)
    client_id = db.Column(db.String(100))
    access_token = db.Column(db.String(500), nullable=True)
    oauth_state = db.Column(db.String(64), nullable=True, index=True)
    token_expires_at = db.Column(db.DateTime, nullable=True)
    is_connected = db.Column(db.Boolean, default=False)
    last_synced_at = db.Column(db.DateTime, nullable=True)

    investor = db.relationship('Investor', back_populates='broker_connections')
    holdings = db.relationship('Holding', back_populates='broker_connection', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'investor_id': self.investor_id,
            'broker_name': self.broker_name,
            'client_id': self.client_id,
            'is_connected': self.is_connected,
            'has_live_token': bool(self.access_token),
            'token_expires_at': self.token_expires_at.isoformat() if self.token_expires_at else None,
            'last_synced_at': self.last_synced_at.isoformat() if self.last_synced_at else None,
            'portfolio_value': round(sum(h.market_value for h in self.holdings), 2),
        }


class Holding(db.Model):
    __tablename__ = 'holdings'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=False)
    broker_connection_id = db.Column(db.Integer, db.ForeignKey('broker_connections.id'), nullable=True)
    symbol = db.Column(db.String(30), nullable=False)
    quantity = db.Column(db.Float, default=0)
    avg_price = db.Column(db.Float, default=0)
    ltp = db.Column(db.Float, default=0)
    day_change_pct = db.Column(db.Float, default=0)
    asset_type = db.Column(db.String(20), default='Stock')
    sector = db.Column(db.String(50))

    investor = db.relationship('Investor', back_populates='holdings')
    broker_connection = db.relationship('BrokerConnection', back_populates='holdings')

    @property
    def market_value(self):
        return round((self.ltp or self.avg_price or 0) * (self.quantity or 0), 2)

    @property
    def pnl(self):
        return round(((self.ltp or 0) - (self.avg_price or 0)) * (self.quantity or 0), 2)

    def to_dict(self):
        return {
            'id': self.id,
            'investor_id': self.investor_id,
            'symbol': self.symbol,
            'quantity': self.quantity,
            'avg_price': self.avg_price,
            'ltp': self.ltp,
            'day_change_pct': self.day_change_pct,
            'asset_type': self.asset_type,
            'sector': self.sector,
            'market_value': self.market_value,
            'pnl': self.pnl,
            'broker': self.broker_connection.broker_name if self.broker_connection else 'Manual',
        }


class WealthAsset(db.Model):
    __tablename__ = 'wealth_assets'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    asset_type = db.Column(db.String(30), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Float, default=0)
    investor_id = db.Column(db.Integer, db.ForeignKey('investors.id'), nullable=True)
    notes = db.Column(db.String(200))

    def to_dict(self):
        return {
            'id': self.id,
            'asset_type': self.asset_type,
            'name': self.name,
            'value': self.value,
            'investor_id': self.investor_id,
            'notes': self.notes,
        }


class AIRecommendation(db.Model):
    __tablename__ = 'ai_recommendations'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text)
    action_type = db.Column(db.String(50))
    priority = db.Column(db.String(20), default='medium')
    is_dismissed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'body': self.body,
            'action_type': self.action_type,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    field_name = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class UpcomingIPO(db.Model):
    """Live IPO feed synced from Moneycontrol / Chittorgarh / other sources."""
    __tablename__ = 'upcoming_ipos'

    id = db.Column(db.Integer, primary_key=True)
    ipo_name = db.Column(db.String(200), nullable=False)
    ipo_type = db.Column(db.String(50), default='Mainboard')
    ipo_status = db.Column(db.String(50), default='upcoming')  # open, upcoming, closed, listed
    bidding_open = db.Column(db.Date)
    bidding_close = db.Column(db.Date)
    allotment_date = db.Column(db.Date)
    listing_date = db.Column(db.Date)
    price_band_low = db.Column(db.Float)
    price_band_high = db.Column(db.Float)
    lot_size = db.Column(db.Integer)
    source = db.Column(db.String(50), default='manual')
    external_id = db.Column(db.String(100))
    source_url = db.Column(db.String(500))
    total_subscription = db.Column(db.Float)
    is_active = db.Column(db.Boolean, default=True)
    last_synced_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('source', 'external_id', name='uq_ipo_source_external'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'ipo_name': self.ipo_name,
            'ipo_type': self.ipo_type,
            'ipo_status': self.ipo_status,
            'bidding_open': self.bidding_open.isoformat() if self.bidding_open else None,
            'bidding_close': self.bidding_close.isoformat() if self.bidding_close else None,
            'allotment_date': self.allotment_date.isoformat() if self.allotment_date else None,
            'listing_date': self.listing_date.isoformat() if self.listing_date else None,
            'price_band_low': self.price_band_low,
            'price_band_high': self.price_band_high,
            'lot_size': self.lot_size,
            'source': self.source,
            'source_url': self.source_url,
            'total_subscription': self.total_subscription,
            'last_synced_at': self.last_synced_at.isoformat() if self.last_synced_at else None,
        }
