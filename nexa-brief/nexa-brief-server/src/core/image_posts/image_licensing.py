"""License whitelist and readable attribution for Wikimedia image assets."""

from __future__ import annotations

import re
from html import unescape


def normalize_license(value: str) -> str:
    text = unescape(re.sub(r"<[^>]*>", " ", str(value or "")))
    return re.sub(r"\s+", " ", text).strip().casefold()


def accepted_license(short_name: str) -> bool:
    """Allow public domain, CC0, and versioned CC BY / CC BY-SA licenses."""
    name = normalize_license(short_name)
    if not name or "fair use" in name or "fair-use" in name:
        return False
    if re.search(r"\b(?:nc|nd)\b|non[ -]?commercial|no[ -]?derivatives", name):
        return False
    if name in {"public domain", "pd"} or name.startswith(("pd-", "pd_")):
        return True
    if re.search(r"\bcc\s*0\b|creative commons zero", name):
        return True

    versioned = bool(re.search(r"\b[1-9]\d*(?:\.\d+){1,2}\b", name))
    if not versioned:
        return False
    by_sa = "share alike" in name or bool(re.search(r"\bby\s*[- ]\s*sa\b|\bby-sa\b", name))
    by = "attribution" in name or bool(re.search(r"\bcc\s*by\b|\bby\s*[- ]?\s*sa\b", name))
    return by and (by_sa or not re.search(r"\bsa\b", name))


def license_simplicity(short_name: str) -> float:
    name = normalize_license(short_name)
    if name.startswith("pd") or "public domain" in name:
        return 1.0
    if "cc0" in name or "creative commons zero" in name:
        return 0.98
    if "share alike" in name or "by-sa" in name or "by sa" in name:
        return 0.70
    if "attribution" in name or re.search(r"\bcc\s*by\b", name):
        return 0.82
    return 0.0
