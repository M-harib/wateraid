"""Draft parser: JSON -> Finding, including conflict, computed inputs, and malformed."""
from __future__ import annotations

import json

from core import Status
from tools.compliance.draft import parse_finding


def test_parse_confirmed_with_evidence():
    raw = json.dumps({
        "status": "confirmed", "claim": "Effective date is the last signature date.",
        "evidence": [{"doc_id": "03", "page": 3, "section": "Art.3", "quote": "date of the last signature"}],
    })
    f = parse_finding(raw, topic="agreement_date")
    assert f.status == Status.confirmed
    assert f.evidence[0].ref.doc_id == "03" and f.evidence[0].ref.page == 3
    assert f.evidence[0].verified is False  # verifier not run yet
    assert f.stable_key.startswith("c:agreement_date:")


def test_parse_conflict_keeps_resolver():
    raw = json.dumps({
        "status": "conflict", "claim": "9.5% vs 10%",
        "evidence": [{"doc_id": "03", "page": 2, "quote": "nine point five percent"},
                     {"doc_id": "01", "page": 5, "quote": "at least 10 percent"}],
        "conflict": {"question": "Does it meet the call?", "resolver": "gac"},
    })
    f = parse_finding(raw, topic="cost_share_conflict")
    assert f.status == Status.conflict and f.conflict.resolver.value == "gac"
    assert len(f.evidence) == 2


def test_parse_computed_inputs_attached_without_result():
    raw = json.dumps({"status": "confirmed", "claim": "x",
                      "evidence": [{"doc_id": "04", "page": 4, "quote": "q"}],
                      "computed_inputs": {"numerator": 11, "denominator": 20, "stated_pct": 71}})
    f = parse_finding(raw, topic="indicator_value")
    assert f.computed.inputs["numerator"] == 11 and f.computed.result is None


def test_parse_malformed_is_needs_review():
    f = parse_finding("not json at all", topic="agreement_date")
    assert f.status == Status.needs_review and f.evidence == []
