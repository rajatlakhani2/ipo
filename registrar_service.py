"""Registrar detection and portal links for allotment workflows."""

REGISTRARS = {
    'Link Intime': {
        'url': 'https://linkintime.co.in/ipo/allotment.html',
        'check_url': 'https://linkintime.co.in/',
        'domains': ['linkintime', 'link in time'],
    },
    'KFin Technologies': {
        'url': 'https://ipostatus.kfintech.com/',
        'check_url': 'https://ipostatus.kfintech.com/',
        'domains': ['kfintech', 'kfin', 'karvy'],
    },
    'Bigshare Services': {
        'url': 'https://www.bigshareonline.com/ipo_allotment.html',
        'check_url': 'https://www.bigshareonline.com/',
        'domains': ['bigshare', 'big share'],
    },
}


def detect_registrar(ipo_name):
    name = (ipo_name or '').lower()
    for reg, meta in REGISTRARS.items():
        for d in meta['domains']:
            if d in name:
                return reg
    # Rotate by hash for demo variety
    keys = list(REGISTRARS.keys())
    return keys[hash(ipo_name or '') % len(keys)]


def registrar_info(ipo_name):
    reg = detect_registrar(ipo_name)
    meta = REGISTRARS[reg]
    return {
        'registrar': reg,
        'portal_url': meta['url'],
        'check_url': meta['check_url'],
        'status': 'ready',
        'note': 'Use Check Registrar in Allotment Center for batch PAN verification.',
    }


def list_registrars():
    return [
        {'name': k, 'portal_url': v['url'], 'check_url': v['check_url']}
        for k, v in REGISTRARS.items()
    ]
