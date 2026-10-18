"""Compliance dispatch routes the test questions to the right intents and tiers."""
from __future__ import annotations

import pytest

from core import route
from tools.compliance.config import DEFAULT, KEYWORDS, TABLE


@pytest.mark.parametrize("question, intent", [
    ("On what date did the contribution agreement take effect?", "agreement_date"),
    ("When was the Year 3 annual results report due, and was it submitted on time?", "reporting_calendar"),
    ("When is the final results and operations report due? Is the agreement consistent on this?", "report_consistency"),
    ("Does Water Care's minimum contribution meet the call's cost-share requirement?", "cost_share_conflict"),
    ("Which version of GAC's General Terms and Conditions applies?", "gtc_version"),
    ("Which documents disagree about the reporting period or due dates?", "cross_doc_conflict"),
    ("What are the three most urgent issues for Water Care?", "urgency_synthesis"),
])
def test_routing(question, intent):
    assert route(question, KEYWORDS, TABLE, DEFAULT).name == intent


def test_unmatched_falls_through_to_strong_conflict_path():
    i = route("tell me something random", KEYWORDS, TABLE, DEFAULT)
    assert i.name == DEFAULT and i.tier == "strong"


def test_conflict_and_synthesis_intents_are_strong_pinned():
    for name in ("cost_share_conflict", "report_consistency", "cross_doc_conflict",
                 "urgency_synthesis", "advances", "partner_change", "spending_approval"):
        assert TABLE[name].tier == "strong"
