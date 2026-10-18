"""The gate: validate() rules and the cheap -> repair -> escalate -> needs_review ladder."""
from __future__ import annotations

from core import Conflict, Evidence, Finding, Resolver, SourceRef, Status
from core.pipeline import run, validate


def _ev(verified=True):
    return Evidence(ref=SourceRef("03", page=1), quote="q", verified=verified)


def _f(status, *, evidence=None, conflict=None, searched=None, claim="c"):
    return Finding(id="i", stable_key="k", tool="t", topic="o", claim=claim, status=status,
                   evidence=evidence or [], conflict=conflict, searched=searched or [])


# --- validate() ---

def test_valid_confirmed_and_conflict_and_not_found():
    assert validate(_f(Status.confirmed, evidence=[_ev()])) is None
    conflict = _f(Status.conflict, evidence=[_ev(), _ev()],
                  conflict=Conflict("q?", Resolver.gac))
    assert validate(conflict) is None
    assert validate(_f(Status.not_found, searched=["03", "04"])) is None


def test_invalid_reasons():
    assert validate(_f(Status.confirmed, claim="  ")) == "empty claim"
    assert validate(_f(Status.confirmed, evidence=[_ev(verified=False)])) == "unverified quote"
    assert validate(_f(Status.needs_review)) == "needs_review"
    assert validate(_f(Status.confirmed)) == "confirmed without evidence"
    assert validate(_f(Status.conflict, evidence=[_ev(), _ev()])) == "conflict without resolver"
    assert validate(_f(Status.conflict, evidence=[_ev()],
                       conflict=Conflict("q?", Resolver.gac))) == "conflict with <2 evidence"
    assert validate(_f(Status.not_found)) == "not_found without searched[]"


# --- run() ladder ---

async def test_run_accepts_good_draft_without_escalation():
    async def draft(tier, reason):
        return _f(Status.confirmed, evidence=[_ev()])
    res = await run("mini", draft)
    assert res.reason is None and res.escalated is False and res.tier_used == "mini"


async def test_run_repairs_then_escalates_then_succeeds():
    calls = []
    async def draft(tier, reason):
        calls.append((tier, reason))
        # fail mini (initial + repair), succeed on strong
        if tier == "mini":
            return _f(Status.needs_review)
        return _f(Status.confirmed, evidence=[_ev()])
    res = await run("mini", draft)
    assert res.reason is None and res.escalated is True and res.tier_used == "strong"
    assert [c[0] for c in calls] == ["mini", "mini", "strong"]  # initial, repair, escalate


async def test_run_exhausts_to_needs_review():
    async def draft(tier, reason):
        return _f(Status.confirmed, evidence=[_ev(verified=False)])  # always unverified
    res = await run("mini", draft)
    assert res.finding.status == Status.needs_review and res.reason == "unverified quote"
