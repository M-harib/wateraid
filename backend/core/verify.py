"""Quote verifier (no LLM): unverified quotes downgrade confirmed findings — the hallucination guard."""
from __future__ import annotations

import re
import unicodedata

from .schema import Finding, Status, Unit

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]")
_SMART = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-"})


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).translate(_SMART)
    s = _PUNCT.sub(" ", s)
    return _WS.sub(" ", s).strip().casefold()


def quote_in_text(quote: str, text: str) -> bool:
    q = normalize(quote)
    return bool(q) and q in normalize(text)


def verify_quote(quote: str, unit: Unit) -> bool:
    return quote_in_text(quote, unit.text)


def verify_finding(finding: Finding, unit_lookup) -> Finding:
    """Verify each quote; downgrade a confirmed finding to needs_review if any fails."""
    all_ok = True
    for ev in finding.evidence:
        unit = unit_lookup(ev.ref)
        ev.verified = bool(unit and verify_quote(ev.quote, unit))
        all_ok = all_ok and ev.verified
    if finding.status == Status.confirmed and finding.evidence and not all_ok:
        finding.status = Status.needs_review
    return finding
