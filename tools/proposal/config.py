"""Proposal routing policy, not pack answers."""
from datetime import date

from core.dispatch import Intent

AS_OF = date(2022, 6, 30)
PROPOSAL_SOURCE_DOCS = ("01", "02", "03", "04", "05", "06")
GENERIC_PROPOSAL_DOCS = ("01", "02", "05", "06")
TABLE = {
    "cost_share_vs_call": Intent("cost_share_vs_call", ("03", "01"), ("check_cost_share", "conflict"), "strong"),
    "construction_vs_call": Intent("construction_vs_call", ("01", "02", "03", "04"), ("callmatch", "conflict"), "strong"),
    "unsupported_claims": Intent("unsupported_claims", ("02", "04"), ("grounding",), "strong"),
    "logic_model_quality": Intent("logic_model_quality", ("05",), ("check_target_baseline", "outcome_quality"), "mini"),
    "generic_qa": Intent("generic_qa", GENERIC_PROPOSAL_DOCS, (), "strong"),
}
KEYWORDS = {
    "cost_share_vs_call": ("cost share", "cost-share", "minimum contribution"),
    "construction_vs_call": ("construction", "refurbishment", "latrine"),
    "logic_model_quality": ("logic model", "indicator", "baseline", "target", "pmf"),
    "unsupported_claims": ("unsupported", "supporting evidence", "uncited", "lack evidence"),
}
# Focused comparisons need only the most relevant pages from each required document.
# Corpus-wide checks such as unsupported claims and the checklist intentionally remain exhaustive.
CONTEXT_UNITS_PER_DOC = {
    "cost_share_vs_call": 2,
    "construction_vs_call": {"01": 1, "02": 1, "03": 1, "04": 2},
}
STARTUP_TOPICS = ("cost_share_vs_call", "construction_vs_call", "unsupported_claims")
CHECKLIST_CATEGORIES = (
    "eligibility", "funding_range", "duration", "cost_share", "location", "local_partners",
    "construction_refurbishment", "required_outcomes", "required_documents",
)


def dispatch(question: str) -> Intent:
    q = question.lower()
    if (any(keyword in q for keyword in KEYWORDS["cost_share_vs_call"])
            and (q.strip() == "cost share" or "minimum contribution" in q
                 or any(marker in q for marker in ("call", "meet", "require", "compare", "conflict")))):
        return TABLE["cost_share_vs_call"]
    if any(keyword in q for keyword in KEYWORDS["unsupported_claims"]):
        return TABLE["unsupported_claims"]
    if (any(keyword in q for keyword in KEYWORDS["construction_vs_call"])
            and any(marker in q for marker in ("call", "rule", "allow", "eligible", "conflict", "fit"))):
        return TABLE["construction_vs_call"]
    if (any(keyword in q for keyword in KEYWORDS["logic_model_quality"])
            and any(marker in q for marker in ("quality", "weak", "missing", "below", "confus", "measure"))):
        return TABLE["logic_model_quality"]
    return TABLE["generic_qa"]
