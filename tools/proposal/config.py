"""Proposal routing policy, not pack answers."""
from datetime import date

from core.dispatch import Intent, route

AS_OF = date(2022, 6, 30)
TABLE = {
    "cost_share_vs_call": Intent("cost_share_vs_call", ("03", "01"), ("check_cost_share", "conflict"), "strong"),
    "construction_vs_call": Intent("construction_vs_call", ("01", "02", "03", "04"), ("callmatch", "conflict"), "strong"),
    "unsupported_claims": Intent("unsupported_claims", ("02", "04"), ("grounding",), "strong"),
    "logic_model_quality": Intent("logic_model_quality", ("05",), ("check_target_baseline", "outcome_quality"), "mini"),
}
KEYWORDS = {
    "cost_share_vs_call": ("cost share", "cost-share", "minimum contribution"),
    "construction_vs_call": ("construction", "refurbishment", "latrine"),
    "logic_model_quality": ("logic model", "indicator", "baseline", "target", "pmf"),
    "unsupported_claims": ("unsupported", "supporting evidence", "uncited", "claims"),
}
# Focused comparisons need only the most relevant pages from each required document.
# Corpus-wide checks such as unsupported claims and the checklist intentionally remain exhaustive.
CONTEXT_UNITS_PER_DOC = {
    "cost_share_vs_call": 2,
    "construction_vs_call": {"01": 1, "02": 1, "03": 1, "04": 2},
}
STARTUP_QUESTIONS = (
    "Does the agreement's minimum contribution meet the call's cost-share requirement?",
    "Which proposed or reported construction activities may conflict with the call?",
    "Which claims in the proposal and results report lack supporting evidence in those documents?",
)
CHECKLIST_CATEGORIES = (
    "eligibility", "funding_range", "duration", "cost_share", "location", "local_partners",
    "construction_refurbishment", "required_outcomes", "required_documents",
)


def dispatch(question: str) -> Intent:
    return route(question, KEYWORDS, TABLE, default="unsupported_claims")
