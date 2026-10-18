"""Dashboard views over the stored findings (FE-shaped dicts)."""
from __future__ import annotations

from core import Finding, checks, locator_label, to_dict

from .config import AS_OF


def issues(findings: list[Finding], as_of=AS_OF) -> list[dict]:
    """Findings ranked by urgency, each linked to its sources and resolver."""
    rows = [
        {
            "finding_id": f.id,
            "topic": f.topic,
            "claim": f.claim,
            "status": f.status.value,
            "urgency": checks.score_urgency(f, as_of),
            "resolver": f.conflict.resolver.value if f.conflict else None,
            "due": f.due.isoformat() if f.due else None,
            "sources": [{"ref": to_dict(e.ref), "locator_label": locator_label(e.ref),
                         "verified": e.verified} for e in f.evidence],
        }
        for f in findings
    ]
    rows.sort(key=lambda r: r["urgency"], reverse=True)
    return rows
