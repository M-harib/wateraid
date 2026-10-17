"""Deterministic oracles: thresholds, sums, percentages, targets, dates, urgency."""
from __future__ import annotations

from datetime import date

from core import Finding, Status
from core.checks import (
    check_cost_share,
    check_dates,
    check_pct,
    check_sum,
    check_target_baseline,
    check_threshold,
    score_urgency,
)


def test_threshold_within_and_exceeds():
    assert check_threshold(0.20, 0.20).result["ok"] is True          # 20% transfer allowed
    assert check_threshold(0.25, 0.20).result["ok"] is False         # 25% needs approval


def test_sum_detects_mismatch():
    # agreement direct reach components vs stated total (15,600 + 6,850 != 23,450)
    r = check_sum({"women_girls": 15600, "men_boys": 6850}, 23450).result
    assert r["matches"] is False and r["delta"] == 1000


def test_pct_recompute_flags_bad_percentage():
    # 11 of 20 HCFs is 55%, not the stated 71%
    r = check_pct(11, 20, stated_pct=71).result
    assert r["computed_pct"] == 55 and r["matches"] is False


def test_target_baseline_missing_and_below():
    assert check_target_baseline(0, None).result["target_missing"] is True       # 1220.1 no target
    assert check_target_baseline(70, 35).result["target_below_baseline"] is True  # 1110.1


def test_cost_share_gap():
    r = check_cost_share(9.5, 10.0).result
    assert r["meets_call"] is False and r["gap"] == 0.5


def test_dates_compute_vs_asserted_and_status():
    # Disposal of Assets Plan: 90 days before activities end (2023-03-31)
    r = check_dates(date(2023, 3, 31), -90, as_of=date(2022, 6, 30),
                    asserted=date(2023, 2, 28)).result
    assert r["rule_due"] == "2022-12-31"
    assert r["mismatch"] is True
    assert r["status_vs_as_of"] == "upcoming"


def test_dates_overdue_vs_as_of():
    r = check_dates(date(2022, 3, 31), 45, as_of=date(2022, 6, 30)).result
    assert r["rule_due"] == "2022-05-15" and r["status_vs_as_of"] == "overdue"


def _f(status, due=None):
    return Finding(id="i", stable_key="k", tool="t", topic="o", claim="c", status=status, due=due)


def test_urgency_ranks_overdue_above_upcoming_above_conflict():
    as_of = date(2022, 6, 30)
    overdue = score_urgency(_f(Status.confirmed, date(2022, 5, 15)), as_of)
    upcoming = score_urgency(_f(Status.confirmed, date(2022, 11, 14)), as_of)
    conflict = score_urgency(_f(Status.conflict), as_of)
    assert overdue > upcoming > conflict
