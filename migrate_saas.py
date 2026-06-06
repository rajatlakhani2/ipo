"""Migrate legacy db_v2.sqlite data into default organization (run once)."""
import os
import sqlite3
from datetime import datetime

from app import create_app
from extensions import db
from models import User, Organization, OrganizationMember, Investor, IPO, Application


LEGACY_DB = os.path.join(os.path.dirname(__file__), 'instance', 'db_v2.sqlite')
if not os.path.exists(LEGACY_DB):
    LEGACY_DB = os.path.join(os.path.dirname(__file__), 'db_v2.sqlite')


def migrate(email='admin@local.dev', password='admin123', org_name='Legacy Workspace'):
    app = create_app()
    with app.app_context():
        if User.query.filter_by(email=email).first():
            print('User already exists — skip or use different email')
            return

        user = User(email=email, full_name='Legacy Admin')
        user.set_password(password)
        slug = org_name.lower().replace(' ', '-')[:80]
        org = Organization(name=org_name, slug=slug)
        db.session.add(user)
        db.session.add(org)
        db.session.flush()
        db.session.add(OrganizationMember(user_id=user.id, organization_id=org.id, role='owner'))

        if not os.path.exists(LEGACY_DB):
            db.session.commit()
            print(f'No legacy DB at {LEGACY_DB}. Created empty workspace: {email} / {password}')
            return

        conn = sqlite3.connect(LEGACY_DB)
        conn.row_factory = sqlite3.Row

        inv_map = {}
        for row in conn.execute('SELECT * FROM investor'):
            inv = Investor(
                organization_id=org.id,
                name=row['name'],
                upi=row['upi'],
                family_group=row['family_group'],
                banks=row['banks'],
            )
            db.session.add(inv)
            db.session.flush()
            inv_map[row['id']] = inv.id

        ipo_map = {}
        for row in conn.execute('SELECT * FROM ipo'):
            ipo = IPO(
                organization_id=org.id,
                ipo_name=row['ipo_name'],
                ipo_type=row['ipo_type'],
                status=row['status'],
                lifecycle_stage='Closed' if row['status'] == 'Closed' else 'Open',
                num_shares=row['num_shares'],
                purchase_price_per_share=row['purchase_price_per_share'],
                sale_price_per_share=row['sale_price_per_share'],
            )
            db.session.add(ipo)
            db.session.flush()
            ipo_map[row['id']] = ipo.id

        for row in conn.execute('SELECT * FROM application'):
            db.session.add(Application(
                organization_id=org.id,
                investor_id=inv_map.get(row['investor_id']),
                ipo_id=ipo_map.get(row['ipo_id']),
                application_amount=row['application_amount'],
                status=row['status'],
                payment_status=row['payment_status'],
                bank_name=row['bank_name'],
                sell_price=row['sell_price'] if 'sell_price' in row.keys() else None,
            ))

        db.session.commit()
        conn.close()
        print(f'Migration complete. Login: {email} / {password}')


if __name__ == '__main__':
    migrate()
