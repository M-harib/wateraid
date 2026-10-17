"""Clearly-labelled placeholders (GG_FIXTURES=1) so the dashboard can integrate
before the pipeline runs with an API key. Never a real answer."""
from __future__ import annotations

FIXTURE_FINDINGS = [
    {
        "id": "fixture-1",
        "kind": "fixture",
        "title": "CONTRACT EXAMPLE – not a finding",
        "summary": "Placeholder so the dashboard renders before the pipeline runs. Not a real finding.",
        "priority": "low",
        "state": "needs_review",
        "nextAction": "Set OPENROUTER_API_KEY and unset GG_FIXTURES for real findings.",
        "owner": None,
        "resolver": None,
        "dueOn": None,
        "evidence": [{
            "id": "03:p1", "documentId": "03", "version": None,
            "locator": {"page": 1}, "excerpt": "CONTRACT EXAMPLE – not a finding", "verified": False,
        }],
    }
]

FIXTURE_ANSWER = {
    "answer": "CONTRACT EXAMPLE – connect the analysis service with an API key for real answers.",
    "status": "not_found",
    "evidence": [],
}
