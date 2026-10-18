"""Proposal-local checklist view models; the shared schema is unchanged."""
import re
from dataclasses import dataclass, field
from datetime import date

from core import Computed, Evidence, Unit, to_dict
from core.checks import check_cost_share
from core.checks.callmatch import Activity, CallRule, callmatch, check_call_duration

from .evidence import InvalidOutput, array, cite, cited_percentage, object_value, text

STATUSES = {"met", "not_met", "unclear", "not_addressed"}


@dataclass
class ChecklistRow:
    id: str
    category: str
    requirement: str
    status: str
    reason: str
    evidence: list[Evidence]
    searched: list[str]
    absent_sources: list[str] = field(default_factory=list)
    computed: Computed | None = None

    def to_dict(self) -> dict:
        return to_dict(self)


def _date(evidence: Evidence) -> date:
    values = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", evidence.quote)
    if len(set(values)) != 1:
        raise InvalidOutput("Date quote must contain one ISO date")
    return date.fromisoformat(values[0])


def compare(raw: dict, units: dict[str, Unit]) -> tuple[Computed, list[Evidence]]:
    kind = raw.get("kind")
    if kind == "cost_share":
        proposal, call = cite(raw.get("proposal"), units, {"02"}), cite(raw.get("call"), units, {"01"})
        result = check_cost_share(cited_percentage(proposal), cited_percentage(call))
        return Computed(result.inputs, {**result.result, "status": "met" if result.result["meets_call"] else "not_met"}), [proposal, call]
    if kind == "construction":
        activity, rule = cite(raw.get("activity"), units, {"02"}), cite(raw.get("rule"), units, {"01"})
        result = callmatch(CallRule(raw.get("new_construction_allowed")),
                           Activity(text(raw.get("activity_kind"), "activity_kind"), activity.quote))
        return result, [rule, activity]
    if kind == "duration":
        start, end, rule = (cite(raw.get(k), units, {"01"} if k == "rule" else {"02"}) for k in ("start", "end", "rule"))
        first, last = _date(start), _date(end)
        words = dict(zip("one two three four five six seven eight nine ten".split(), range(1, 11)))
        rule_text = re.sub(r"\b(" + "|".join(words) + r")\b", lambda m: str(words[m[0]]), rule.quote.lower())
        minimum = re.search(r"at least (\d+) years?", rule_text)
        maximum = re.search(r"(?:no more than|at most) (\d+) years?", rule_text)
        if not minimum or not maximum or last < first:
            raise InvalidOutput("Duration comparison needs explicit year bounds and ordered dates")
        lo, hi = int(minimum[1]), int(maximum[1])
        if lo > hi:
            raise InvalidOutput("Duration bounds are inconsistent")
        return check_call_duration(first, last, lo, hi), [rule, start, end]
    raise InvalidOutput("Unknown checklist comparison")


def parse_row(raw, *, row_id: str, units: dict[str, Unit], absent_ids: set[str]) -> ChecklistRow:
    raw = object_value(raw, "checklist row")
    status = text(raw.get("status"), "status")
    if status not in STATUSES:
        raise InvalidOutput("Invalid checklist status")
    category, requirement = text(raw.get("category"), "category"), text(raw.get("requirement"), "requirement")
    reason = text(raw.get("reason"), "reason")
    call = cite(raw.get("call"), units, {"01"})
    proposal = []
    dropped_proposal_evidence = False
    for item in array(raw.get("proposal"), "proposal evidence"):
        try:
            proposal.append(cite(item, units, {"02"}))
        except InvalidOutput:
            # A malformed optional proposal quote cannot support met/not_met. Keep the
            # call rule and downgrade the row so one bad excerpt does not erase the list.
            dropped_proposal_evidence = True
    expected = {key for key, unit in units.items() if unit.doc_id == "02"}
    supplied_search = array(raw.get("searched_units", []), "searched_units")
    if not all(isinstance(key, str) and key in expected for key in supplied_search):
        raise InvalidOutput("Checklist search metadata references an unknown proposal unit")
    # The pipeline supplied every proposal page to this checklist run. Record that
    # auditable scope in code rather than trusting the model to repeat six IDs per row.
    searched = sorted(expected)
    absent = array(raw.get("absent_sources", []), "absent_sources")
    if not all(isinstance(key, str) and key in absent_ids for key in absent):
        raise InvalidOutput("Unknown absent source")
    if status in {"met", "not_met"} and not proposal:
        status = "unclear"
        reason = "Proposal evidence supplied by analysis did not verify; staff review is required. " + reason
    if status == "not_addressed" and proposal:
        raise InvalidOutput("not_addressed must not discard relevant proposal evidence")
    if status == "not_addressed":
        reason = "Proposal 02 does not address this requirement in the searched pages. " + reason
    evidence, computed = [call, *proposal], None
    if raw.get("comparison") is not None:
        try:
            computed, more = compare(object_value(raw["comparison"], "comparison"), units)
            evidence.extend(e for e in more if e not in evidence)
            status = computed.result["status"]
            reason = f"Code comparison: {computed.result}. Assessment: {reason}"
        except InvalidOutput as exc:
            status = "unclear"
            reason = f"Deterministic comparison could not run because cited inputs did not verify ({exc}). " + reason
    elif category in {"cost_share", "duration", "construction_refurbishment", "funding_range"} and status in {"met", "not_met"}:
        status = "unclear"
        reason = "No supported deterministic comparison is available. " + reason
    if absent:
        status = "unclear"
        reason = f"Not in the documents: {', '.join(absent)}. Completeness cannot be checked. " + reason
    if dropped_proposal_evidence and proposal:
        status = "unclear"
        reason = "At least one proposal excerpt did not verify; the row is incomplete. " + reason
    return ChecklistRow(row_id, category, requirement, status, reason, evidence, searched, absent, computed)
