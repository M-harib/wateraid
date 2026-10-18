"""Eval scorer classifies findings into the 5 categories + hallucination rate."""
from __future__ import annotations

from core import Conflict, Evidence, Finding, Resolver, SourceRef, Status
from tests.eval.scorer import hallucination_rate, load_gold, score


def _ev(doc, section=None, page=None, verified=True):
    return Evidence(ref=SourceRef(doc, section=section, page=page), quote="q", verified=verified)


def _f(status, **kw):
    base = dict(id="i", stable_key="k", tool="t", topic="o", claim="c")
    return Finding(status=status, **{**base, **kw})


def test_correct_with_citation():
    f = _f(Status.confirmed, evidence=[_ev("03", section="Art.2.1", page=2)])
    gold = {"expect_status": "confirmed", "must_cite": ["03:Art.2.1"]}
    assert score(f, gold) == "correct_with_citation"


def test_wrong_when_required_citation_missing():
    f = _f(Status.confirmed, evidence=[_ev("03", section="Art.9")])
    gold = {"expect_status": "confirmed", "must_cite": ["03:Art.2.1"]}
    assert score(f, gold) == "wrong"


def test_correct_conflict_with_resolver():
    f = _f(Status.conflict, evidence=[_ev("03"), _ev("01")],
           conflict=Conflict("meets call?", Resolver.gac))
    assert score(f, {"expect_status": "conflict", "expect_resolver": "gac"}) \
        == "correct_conflict_with_resolver"


def test_conflict_wrong_resolver_is_wrong():
    f = _f(Status.conflict, evidence=[_ev("03"), _ev("01")],
           conflict=Conflict("meets call?", Resolver.water_care))
    assert score(f, {"expect_status": "conflict", "expect_resolver": "gac"}) == "wrong"


def test_correct_abstention():
    assert score(_f(Status.not_found, searched=["03"]), {"expect_status": "not_found"}) \
        == "correct_abstention"


def test_unsupported_when_quote_unverified():
    f = _f(Status.confirmed, evidence=[_ev("03", section="Art.2.1", verified=False)])
    gold = {"expect_status": "confirmed", "must_cite": ["03:Art.2.1"]}
    assert score(f, gold) == "unsupported"


def test_hallucination_rate():
    good = _f(Status.confirmed, evidence=[_ev("03")])
    bad = _f(Status.confirmed, evidence=[_ev("03", verified=False)])
    assert hallucination_rate([good, bad, good]) == 1 / 3


def test_gold_file_loads_and_is_well_formed():
    gold = load_gold()
    assert isinstance(gold, list) and gold and all("expect_status" in g for g in gold)
