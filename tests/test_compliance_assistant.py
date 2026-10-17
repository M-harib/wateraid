"""End-to-end ask() over the real corpus with a FakeLLM: verify + gate + checks."""
from __future__ import annotations

import json

from core import FakeLLM, Status
from tools.compliance import ComplianceAssistant, views


async def test_ask_confirmed_with_real_quote(core):
    # a verbatim phrase from the agreement (03, Art. 3, p.3) -> verifies, stays confirmed
    canned = json.dumps({
        "status": "confirmed",
        "claim": "The agreement takes effect on the date of the last signature.",
        "evidence": [{"doc_id": "03", "page": 3, "section": "Art.3",
                      "quote": "The Agreement shall take effect on the date of the last signature"}],
    })
    a = ComplianceAssistant(core, FakeLLM(canned))
    res = await a.ask("On what date did the contribution agreement take effect?")
    assert res.finding.status == Status.confirmed
    assert res.finding.evidence[0].verified is True
    assert res.escalated is False and res.tier_used == "mini"
    assert core.findings.get(res.finding.id) is not None  # stored


async def test_ask_fabricated_quote_escalates_to_needs_review(core):
    canned = json.dumps({
        "status": "confirmed", "claim": "made up",
        "evidence": [{"doc_id": "03", "page": 3, "quote": "this phrase is not in the agreement anywhere"}],
    })
    a = ComplianceAssistant(core, FakeLLM(canned))
    res = await a.ask("On what date did the contribution agreement take effect?")
    assert res.finding.status == Status.needs_review  # unverified -> downgraded, gate exhausts
    assert res.escalated is True and res.tier_used == "strong"


async def test_ask_runs_deterministic_check_as_oracle(core):
    # model proposes raw inputs; code computes the percentage (11/20 = 55%, not 71%)
    canned = json.dumps({
        "status": "confirmed", "claim": "11 of 20 facilities.",
        "evidence": [{"doc_id": "04", "page": 4, "quote": "11 (71%)"}],
        "computed_inputs": {"numerator": 11, "denominator": 20, "stated_pct": 71},
    })
    a = ComplianceAssistant(core, FakeLLM(canned))
    res = await a.ask("How many targeted health care facilities met indicator 1210.3, and what percentage?")
    assert res.finding.computed.result["computed_pct"] == 55
    assert res.finding.computed.result["matches"] is False


async def test_issues_view_ranks_and_links(core):
    canned = json.dumps({
        "status": "conflict", "claim": "sources disagree",
        "evidence": [{"doc_id": "03", "page": 3, "quote": "September 30, 2023"},
                     {"doc_id": "04", "page": 8, "quote": "15 May 2023"}],
        "conflict": {"question": "final report due?", "resolver": "gac"},
    })
    a = ComplianceAssistant(core, FakeLLM(canned))
    await a.ask("When is the final results and operations report due? Is the agreement consistent on this?")
    rows = views.issues(core.findings.all())
    assert rows and rows[0]["resolver"] == "gac"
    assert "locator_label" in rows[0]["sources"][0]
