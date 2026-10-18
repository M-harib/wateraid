"""Compliance dispatch: question -> Intent, and the check adapters that turn
model-proposed inputs into authoritative Computed results (code owns the number)."""
from __future__ import annotations

from datetime import date

from core import Intent, checks

AS_OF = date(2022, 6, 30)  # the scenario clock; never the system clock

# intent -> Intent(docs, checks, tier). Strong = pre-pinned conflict/synthesis paths.
TABLE: dict[str, Intent] = {
    "cost_share_conflict": Intent("cost_share_conflict", ("03", "01", "02"), ("check_cost_share", "conflict"), "strong"),
    "report_consistency":  Intent("report_consistency", ("03", "04"), ("check_dates", "conflict"), "strong"),
    "advances":            Intent("advances", ("03", "04"), ("check_dates",), "strong"),
    "partner_change":      Intent("partner_change", ("03", "04"), ("obligation",), "strong"),
    "spending_approval":   Intent("spending_approval", ("04", "03"), ("check_threshold",), "strong"),
    "cross_doc_conflict":  Intent("cross_doc_conflict", ("04", "03"), ("conflict",), "strong"),
    "urgency_synthesis":   Intent("urgency_synthesis", ("finding_store",), ("score_urgency",), "strong"),
    "agreement_date":      Intent("agreement_date", ("03",), ("check_dates",), "mini"),
    "cost_share_read":     Intent("cost_share_read", ("03",), ("check_cost_share",), "mini"),
    "budget_transfer":     Intent("budget_transfer", ("03", "06"), ("check_threshold",), "mini"),
    "gtc_version":         Intent("gtc_version", ("03",), ("check_absent_source",), "mini"),
    "construction_read":   Intent("construction_read", ("03",), ("obligation",), "mini"),
    "subcontract_cap":     Intent("subcontract_cap", ("03", "04"), ("check_threshold",), "mini"),
    "currency":            Intent("currency", ("03", "04"), ("method_match",), "mini"),
    "reporting_calendar":  Intent("reporting_calendar", ("03", "04"), ("check_dates",), "mini"),
    "indicator_value":     Intent("indicator_value", ("04", "03"), ("check_pct",), "mini"),
    "indicator_quality":   Intent("indicator_quality", ("05",), ("check_target_baseline",), "mini"),
    "reach_figures":       Intent("reach_figures", ("03", "04"), ("check_sum",), "mini"),
}

DEFAULT = "cross_doc_conflict"  # unmatched -> safe conflict path on the strong tier

# Ordered: specific intents first so generic keywords don't shadow them (first hit wins).
KEYWORDS: dict[str, tuple[str, ...]] = {
    "cost_share_conflict": ("minimum contribution", "cost-share requirement", "meet the call"),
    "report_consistency":  ("final results and operations report", "final report", "consistent on this"),
    "advances":            ("advance periods", "outstanding at once"),
    "partner_change":      ("youth engagement partner", "change of youth"),
    "spending_approval":   ("need gac approval", "spending in year 3"),
    "cross_doc_conflict":  ("documents disagree", "reporting period or due dates"),
    "urgency_synthesis":   ("most urgent", "three most urgent"),
    "agreement_date":      ("take effect", "effective date", "expire", "expiry", "activities be completed"),
    "cost_share_read":     ("maximum share", "overhead rate"),
    "budget_transfer":     ("move 25", "travel budget line", "to goods without asking"),
    "gtc_version":         ("general terms and conditions", "gtc"),
    "construction_read":   ("before starting any construction", "before construction"),
    "subcontract_cap":     ("subcontracting",),
    "currency":            ("foreign currenc", "converted to canadian"),
    "reporting_calendar":  ("report due", "work plan due", "disposal of assets plan", "results report due"),
    "indicator_value":     ("1210.3", "health care facilities met", "what percentage"),
    "indicator_quality":   ("no target", "below its baseline"),
    "reach_figures":       ("direct reach", "figures in the agreement add up"),
}


# --- check adapters: model proposes raw inputs, code computes the result ---

def _dates(inp: dict):
    anchor = date.fromisoformat(inp["anchor"])
    asserted = date.fromisoformat(inp["asserted"]) if inp.get("asserted") else None
    return checks.check_dates(anchor, int(inp["offset_days"]), AS_OF, asserted)


CHECK_ADAPTERS = {
    "check_dates": _dates,
    "check_sum": lambda i: checks.check_sum(i["components"], i["stated_total"]),
    "check_pct": lambda i: checks.check_pct(i["numerator"], i["denominator"], i.get("stated_pct")),
    "check_threshold": lambda i: checks.check_threshold(i["value"], i["limit"], at_most=i.get("at_most", True)),
    "check_cost_share": lambda i: checks.check_cost_share(i["agreement_pct"], i["call_pct"]),
    "check_target_baseline": lambda i: checks.check_target_baseline(i.get("baseline"), i.get("target")),
}
