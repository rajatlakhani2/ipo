"""IPO closing alerts — in-app + optional email digest."""
import logging
from datetime import date

from flask import current_app

from extensions import db
from models import IPO, Organization, OrganizationMember, User
logger = logging.getLogger(__name__)


def get_closing_alerts(org_id, days=3):
    today = date.today()
    alerts = []
    for ipo in IPO.query.filter_by(organization_id=org_id, status='Open').all():
        if not ipo.bidding_close_date:
            continue
        left = (ipo.bidding_close_date - today).days
        if 0 <= left <= days:
            alerts.append({
                'ipo_name': ipo.ipo_name,
                'days_left': left,
                'bidding_close_date': ipo.bidding_close_date.isoformat(),
                'ipo_score': ipo.ipo_score,
                'gmp': ipo.gmp,
            })
    return alerts


def send_closing_digest(org_id):
    """Email org owners about IPOs closing within 3 days."""
    alerts = get_closing_alerts(org_id, days=3)
    if not alerts:
        return False

    org = Organization.query.get(org_id)
    owners = OrganizationMember.query.filter_by(organization_id=org_id, role='owner').all()
    emails = []
    for m in owners:
        u = User.query.get(m.user_id)
        if u and u.email:
            emails.append(u.email)
    if not emails:
        return False

    lines = [f"• {a['ipo_name']} — closes in {a['days_left']}d (score {a.get('ipo_score') or '—'})" for a in alerts]
    subject = f"[Family Office] {len(alerts)} IPO(s) closing soon — {org.name}"
    body = f"Workspace: {org.name}\n\nClosing soon:\n" + '\n'.join(lines) + "\n\n— Family Office Dashboard\n"
    return _send_generic_email(emails, subject, body)


def _send_generic_email(recipients, subject, body):
    mail_server = current_app.config.get('MAIL_SERVER')
    if not mail_server:
        logger.info('=== ALERT EMAIL (dev) === To: %s | %s', recipients, subject)
        print(f'\n[Family Office Alert] {subject}\n{body}\n')
        return True
    try:
        import smtplib
        from email.mime.text import MIMEText
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = current_app.config.get('MAIL_FROM', 'noreply@familyoffice.app')
        with smtplib.SMTP(mail_server, current_app.config.get('MAIL_PORT', 587)) as server:
            if current_app.config.get('MAIL_USE_TLS'):
                server.starttls()
            user = current_app.config.get('MAIL_USERNAME')
            pwd = current_app.config.get('MAIL_PASSWORD')
            if user and pwd:
                server.login(user, pwd)
            for to in recipients:
                msg['To'] = to
                server.sendmail(msg['From'], [to], msg.as_string())
        return True
    except Exception as exc:
        logger.warning('Alert email failed: %s', exc)
        return False


def run_daily_alerts():
    """Called from scheduler — all organizations."""
    for org in Organization.query.all():
        try:
            send_closing_digest(org.id)
        except Exception as exc:
            logger.warning('Alert for org %s failed: %s', org.id, exc)
