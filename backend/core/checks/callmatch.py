"""Compare extracted activity classifications with a call rule; no funder constants."""
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from math import isfinite
from typing import Literal

from core.schema import Computed

ActivityKind = Literal["new_construction", "refurbishment", "other", "unknown"]


@dataclass(frozen=True)
class CallRule:
    new_construction_allowed: bool | None = None
    max_expansion_pct: float | None = None


@dataclass(frozen=True)
class Activity:
    kind: ActivityKind
    description: str
    expansion_pct: float | None = None


def callmatch(rule: CallRule, activity: Activity) -> Computed:
    if activity.kind not in {"new_construction", "refurbishment", "other", "unknown"}:
        raise ValueError("Unknown activity kind")
    for value in (rule.max_expansion_pct, activity.expansion_pct):
        if value is not None and (isinstance(value, bool) or not isfinite(value) or value < 0):
            raise ValueError("Expansion must be a finite non-negative percentage")
    if rule.new_construction_allowed is not None and type(rule.new_construction_allowed) is not bool:
        raise ValueError("Construction permission must be boolean or unknown")
    status, reason = "unclear", "The extracted rule or activity does not establish a match."
    if activity.kind == "new_construction" and rule.new_construction_allowed is not None:
        status = "met" if rule.new_construction_allowed else "not_met"
        reason = "New construction is permitted by the cited rule." if rule.new_construction_allowed else "New construction conflicts with the cited prohibition."
    elif activity.kind == "refurbishment" and rule.max_expansion_pct is not None:
        if activity.expansion_pct is None:
            reason = "The activity's footprint expansion is not evidenced."
        else:
            status = "met" if activity.expansion_pct <= rule.max_expansion_pct else "not_met"
            reason = "Footprint expansion compared with the cited limit; other conditions still need review."
    return Computed(inputs={"rule": asdict(rule), "activity": asdict(activity)},
                    result={"status": status, "conflict": status == "not_met", "reason": reason})


def check_call_duration(start: date, end_inclusive: date, minimum_years: int, maximum_years: int) -> Computed:
    """Compare calendar anniversaries, clamping leap-day anchors; inputs come from quotes."""
    if end_inclusive < start or minimum_years < 0 or maximum_years < minimum_years:
        raise ValueError("Duration dates/bounds are inconsistent")

    def anniversary(years: int) -> date:
        try:
            return start.replace(year=start.year + years)
        except ValueError:
            return start.replace(year=start.year + years, day=28)

    exclusive_end = end_inclusive + timedelta(days=1)
    ok = anniversary(minimum_years) <= exclusive_end <= anniversary(maximum_years)
    return Computed({"start": start.isoformat(), "end_inclusive": end_inclusive.isoformat(),
                     "minimum_years": minimum_years, "maximum_years": maximum_years},
                    {"status": "met" if ok else "not_met", "duration_days": (exclusive_end - start).days})
