"""Shared input validators."""
import re

# Demat / BO ID is always 16 characters:
#   CDSL: 16 digits                     e.g. 1208160012345678
#   NSDL: "IN" + 6-digit DP ID + 8-digit Client ID  e.g. IN30012345678901
_DEMAT_RE = re.compile(r'^(\d{16}|IN\d{14})$')

# PAN: 5 letters + 4 digits + 1 letter, all capitals  e.g. ABCDE1234F
_PAN_RE = re.compile(r'^[A-Z]{5}\d{4}[A-Z]$')


def normalize_pan(value):
    """Return (clean_value, error). Uppercases; empty input is allowed."""
    if value is None:
        return None, None
    clean = re.sub(r'\s+', '', str(value)).upper()
    if not clean:
        return None, None
    if not _PAN_RE.match(clean):
        return None, 'PAN must be 10 characters in the format ABCDE1234F (5 letters, 4 digits, 1 letter).'
    return clean, None


def normalize_demat(value):
    """Return (clean_value, error). Empty input is allowed (field is optional)."""
    if value is None:
        return None, None
    clean = re.sub(r'\s+', '', str(value)).upper()
    if not clean:
        return None, None
    if not _DEMAT_RE.match(clean):
        return None, (
            f'Demat Account ID must be exactly 16 characters '
            f'(16 digits for CDSL, or IN + 14 digits for NSDL). Got {len(clean)}.'
        )
    return clean, None


def duplicate_pan_conflict(org_id, ipo_id, investor_id):
    """SEBI allows one application per PAN per IPO; a second one under another
    investor entry with the same PAN or Demat ID gets rejected.
    Returns an error message, or None if this investor may apply."""
    from models import Application, Investor
    inv = Investor.query.filter_by(id=investor_id, organization_id=org_id).first()
    if not inv:
        return 'Investor not found'
    pan = (inv.pan or '').strip().upper()
    demat = (inv.demat_account or '').strip().upper()
    if not pan and not demat:
        return None
    rows = (Application.query.join(Investor, Application.investor_id == Investor.id)
            .filter(Application.organization_id == org_id, Application.ipo_id == ipo_id,
                    Application.investor_id != investor_id)
            .with_entities(Investor.name, Investor.pan, Investor.demat_account, Application.status).all())
    for name, other_pan, other_demat, status in rows:
        if str(status or '').lower() in ('rejected', 'withdrawn', 'cancelled', 'canceled'):
            continue
        if pan and (other_pan or '').strip().upper() == pan:
            return f'PAN {pan} has already applied in this IPO as {name}. A second application with the same PAN gets rejected.'
        if demat and (other_demat or '').strip().upper() == demat:
            return f'Demat ID {demat} has already applied in this IPO as {name}. A second application to the same Demat account gets rejected.'
    return None
