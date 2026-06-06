import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app

logger = logging.getLogger(__name__)


def send_verification_email(user):
    """Send email verification link; logs link in dev when SMTP not configured."""
    token = user.verification_token
    if not token:
        return False

    base = current_app.config.get('APP_BASE_URL', 'http://127.0.0.1:5001').rstrip('/')
    link = f'{base}/verify.html?token={token}'
    subject = 'Verify your IPO Control account'
    body = f"""Hello {user.full_name},

Welcome to IPO Control. Please verify your email to activate your account:

{link}

If you did not create this account, ignore this email.

— IPO Control
"""
    html = f"""
    <p>Hello <strong>{user.full_name}</strong>,</p>
    <p>Welcome to <strong>IPO Control</strong>. Click below to verify your email:</p>
    <p><a href="{link}" style="background:#6366f1;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">Verify Email</a></p>
    <p style="color:#64748b;font-size:12px">Or copy: {link}</p>
    """

    mail_server = current_app.config.get('MAIL_SERVER')
    if not mail_server:
        logger.info('=== EMAIL VERIFICATION (dev — no SMTP) ===')
        logger.info('To: %s | Link: %s', user.email, link)
        print(f'\n[IPO Control] Verify email for {user.email}:\n  {link}\n')
        return True

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = current_app.config.get('MAIL_FROM', 'noreply@ipocontrol.app')
    msg['To'] = user.email
    msg.attach(MIMEText(body, 'plain'))
    msg.attach(MIMEText(html, 'html'))

    try:
        with smtplib.SMTP(mail_server, current_app.config.get('MAIL_PORT', 587)) as server:
            if current_app.config.get('MAIL_USE_TLS'):
                server.starttls()
            username = current_app.config.get('MAIL_USERNAME')
            password = current_app.config.get('MAIL_PASSWORD')
            if username and password:
                server.login(username, password)
            server.sendmail(msg['From'], [user.email], msg.as_string())
        return True
    except Exception as e:
        logger.exception('Failed to send verification email: %s', e)
        return False
