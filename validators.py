"""Shared input validators."""
import re

# Demat / BO ID is always 16 characters:
#   CDSL: 16 digits                     e.g. 1208160012345678
#   NSDL: "IN" + 6-digit DP ID + 8-digit Client ID  e.g. IN30012345678901
_DEMAT_RE = re.compile(r'^(\d{16}|IN\d{14})$')


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
