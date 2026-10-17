"""Deterministic oracles (pure, no LLM): tools feed values, the model only narrates results."""
from __future__ import annotations

from datetime import date, timedelta

from ..schema import Computed, Finding, Status


def check_threshold(value: float, limit: float, *, label: str = "", at_most: bool = True) -> Computed:
    ok = value <= limit if at_most else value >= limit
    return Computed(
        inputs={"value": value, "limit": limit, "at_most": at_most, "label": label},
        result={"ok": ok, "verdict": ("within" if ok else "exceeds") + " limit"},
    )


def check_sum(components: dict, stated_total: float) -> Computed:
    total = sum(components.values())
    return Computed(
        inputs={"components": components, "stated_total": stated_total},
        result={"computed_total": total, "matches": total == stated_total,
                "delta": stated_total - total},
    )


def check_pct(numerator: float, denominator: float, stated_pct: float | None = None,
              *, places: int = 0) -> Computed:
    pct = round(100 * numerator / denominator, places) if denominator else None
    matches = stated_pct is not None and pct is not None and abs(pct - stated_pct) < 0.5
    return Computed(
        inputs={"numerator": numerator, "denominator": denominator, "stated_pct": stated_pct},
        result={"computed_pct": pct, "stated_pct": stated_pct, "matches": matches},
    )


def check_target_baseline(baseline: float | None, target: float | None) -> Computed:
    missing = target is None
    below = not missing and baseline is not None and target < baseline
    return Computed(
        inputs={"baseline": baseline, "target": target},
        result={"target_missing": missing, "target_below_baseline": below},
    )


def check_cost_share(agreement_pct: float, call_pct: float) -> Computed:
    return Computed(
        inputs={"agreement_pct": agreement_pct, "call_pct": call_pct},
        result={"meets_call": agreement_pct >= call_pct, "gap": round(call_pct - agreement_pct, 2)},
    )


def check_dates(anchor: date, offset_days: int, as_of: date, asserted: date | None = None) -> Computed:
    """Rule-derived due date vs the date a source asserts (compute-vs-asserted)."""
    rule_due = anchor + timedelta(days=offset_days)
    return Computed(
        inputs={"anchor": anchor.isoformat(), "offset_days": offset_days,
                "as_of": as_of.isoformat(),
                "asserted": asserted.isoformat() if asserted else None},
        result={"rule_due": rule_due.isoformat(),
                "asserted_due": asserted.isoformat() if asserted else None,
                "mismatch": asserted is not None and asserted != rule_due,
                "status_vs_as_of": "overdue" if rule_due < as_of else "upcoming"},
    )


def score_urgency(finding: Finding, as_of: date) -> int:
    """Rule-based urgency: overdue deadline > imminent > conflict > needs_review."""
    score = 0
    if finding.due is not None:
        score += 100 if finding.due < as_of else 50
    if finding.status == Status.conflict:
        score += 30
    if finding.status == Status.needs_review:
        score += 10
    return score
