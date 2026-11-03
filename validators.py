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
