"""Registrar allotment status checks — KFin, Link Intime, Bigshare."""
import logging
import re

import requests

from registrar_service import detect_registrar, REGISTRARS

logger = logging.getLogger(__name__)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
}


def _parse_status_text(text):
    t = (text or '').lower()
    if not t:
        return 'Unknown', 'No response from registrar'
    if re.search(r'not\s+allot|no\s+allot|unsuccessful|rejected', t):
        return 'Not Allotted', 'Registrar: not allotted'
    if re.search(r'allot|success|shares\s+allot', t):
        return 'Allotted', 'Registrar: allotted'
    if re.search(r'pending|processing|not\s+available|try\s+later', t):
        return 'Pending', 'Registrar: pending or not published yet'
    return 'Unknown', 'Could not parse registrar response'


def check_kfin(pan, application_ref=None, ipo_name=None):
    """Query KFin IPO status portal."""
    pan = (pan or '').strip().upper()
    if not pan or len(pan) < 10:
        return {'status': 'Unknown', 'message': 'Valid PAN required', 'registrar': 'KFin Technologies'}

    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        session.get('https://ipostatus.kfintech.com/', timeout=15)

        payload = {
            'PAN': pan,
            'PANNo': pan,
            'pan': pan,
        }
        if application_ref:
            payload['ApplicationNo'] = application_ref
            payload['applicationNumber'] = application_ref

        endpoints = [
            'https://ipostatus.kfintech.com/iporequest/StatusRequest',
            'https://ipostatus.kfintech.com/IPOStatus/Status',
        ]
        last_text = ''
        for url in endpoints:
            try:
                resp = session.post(url, data=payload, timeout=20)
                last_text = resp.text
                if resp.status_code == 200 and len(last_text) > 50:
                    status, msg = _parse_status_text(last_text)
                    if status != 'Unknown':
                        return {
                            'status': status,
                            'message': msg,
                            'registrar': 'KFin Technologies',
                            'portal_url': REGISTRARS['KFin Technologies']['url'],
                        }
            except requests.RequestException:
                continue

        status, msg = _parse_status_text(last_text)
        return {
            'status': status,
            'message': msg if status != 'Unknown' else 'KFin check inconclusive — verify on portal',
            'registrar': 'KFin Technologies',
            'portal_url': REGISTRARS['KFin Technologies']['url'],
        }
    except Exception as exc:
        logger.warning('KFin check failed: %s', exc)
        return {
            'status': 'Unknown',
            'message': f'KFin error: {exc}',
            'registrar': 'KFin Technologies',
            'portal_url': REGISTRARS['KFin Technologies']['url'],
        }


def check_link_intime(pan, application_ref=None, demat_account=None):
    pan = (pan or '').strip().upper()
    if not pan:
        return {'status': 'Unknown', 'message': 'PAN required', 'registrar': 'Link Intime'}

    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        data = {'pan1': pan, 'PAN': pan}
        if application_ref:
            data['applicationno'] = application_ref
        if demat_account:
            data['dpid'] = demat_account[:8] if demat_account else ''

        resp = session.post(
            'https://linkintime.co.in/MIPO/Ipoallotment.html',
            data=data,
            timeout=20,
        )
        status, msg = _parse_status_text(resp.text)
        return {
            'status': status,
            'message': msg,
            'registrar': 'Link Intime',
            'portal_url': REGISTRARS['Link Intime']['url'],
        }
    except Exception as exc:
        return {
            'status': 'Unknown',
            'message': str(exc),
            'registrar': 'Link Intime',
            'portal_url': REGISTRARS['Link Intime']['url'],
        }


def check_bigshare(pan, application_ref=None):
    pan = (pan or '').strip().upper()
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        resp = session.post(
            'https://www.bigshareonline.com/ipo_allotment.html',
            data={'pan': pan, 'applicationno': application_ref or ''},
            timeout=20,
        )
        status, msg = _parse_status_text(resp.text)
        return {
            'status': status,
            'message': msg,
            'registrar': 'Bigshare Services',
            'portal_url': REGISTRARS['Bigshare Services']['url'],
        }
    except Exception as exc:
        return {
            'status': 'Unknown',
            'message': str(exc),
            'registrar': 'Bigshare Services',
            'portal_url': REGISTRARS['Bigshare Services']['url'],
        }


def check_investor_allotment(ipo_name, pan, application_ref=None, demat_account=None, registrar=None):
    reg = registrar or detect_registrar(ipo_name)
    if reg == 'KFin Technologies':
        return check_kfin(pan, application_ref, ipo_name)
    if reg == 'Link Intime':
        return check_link_intime(pan, application_ref, demat_account)
    if reg == 'Bigshare Services':
        return check_bigshare(pan, application_ref)
    return check_kfin(pan, application_ref, ipo_name)


def batch_check_ipo_applications(ipo, applications):
    """Check all applications for an IPO. applications: list of Application with investor loaded."""
    results = []
    for app in applications:
        inv = app.investor
        if not inv or not inv.pan:
            results.append({
                'application_id': app.id,
                'investor_name': inv.name if inv else '?',
                'pan': None,
                'status': 'Skipped',
                'message': 'Add PAN in Investor Master',
                'registrar': detect_registrar(ipo.ipo_name),
            })
            continue
        check = check_investor_allotment(
            ipo.ipo_name,
            inv.pan,
            app.application_ref,
            inv.demat_account,
        )
        results.append({
            'application_id': app.id,
            'investor_name': inv.name,
            'pan': inv.pan,
            'application_ref': app.application_ref,
            'current_status': app.status,
            **check,
        })
    return results
