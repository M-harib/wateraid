"""Rules router: keyword match, first-hit precedence, default fallthrough."""
from __future__ import annotations

from core import Intent, route

TABLE = {
    "dates": Intent("dates", ("03",), ("check_dates",), "mini"),
    "cost": Intent("cost", ("03", "01"), ("check_cost_share",), "strong"),
    "fallback": Intent("fallback", ("03", "04"), (), "strong"),
}
KEYWORDS = {
    "dates": ("due", "expire"),
    "cost": ("cost share", "contribution"),
}


def test_route_matches_keyword():
    assert route("When is the report due?", KEYWORDS, TABLE, "fallback").name == "dates"
    assert route("Does the contribution meet the call?", KEYWORDS, TABLE, "fallback").name == "cost"


def test_route_first_hit_wins():
    # order of KEYWORDS dict decides precedence on overlap
    assert route("due contribution", KEYWORDS, TABLE, "fallback").name == "dates"


def test_route_unmatched_falls_through_to_default():
    i = route("something unrelated", KEYWORDS, TABLE, "fallback")
    assert i.name == "fallback" and i.tier == "strong"
