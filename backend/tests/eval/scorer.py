"""Classify a pipeline Finding against a hand-authored gold entry (the 5 eval categories)."""
from __future__ import annotations

import json
from pathlib import Path

from core import Finding, Status, locator_label


def load_gold(path: str | Path = "tests/eval/gold.json") -> list[dict]:
    p = Path(path)
    return json.loads(p.read_text()) if p.exists() else []


def _cites_ok(finding: Finding, must_cite: list[str]) -> bool:
    labels = [locator_label(e.ref) for e in finding.evidence]
    for want in must_cite:
        doc, _, frag = want.partition(":")
        hit = any(doc in lbl and (not frag or frag in lbl) for lbl in labels)
        if not hit:
            return False
    return True


def score(finding: Finding, gold: dict) -> str:
    if finding.evidence and any(not e.verified for e in finding.evidence):
        return "unsupported"

    expect = gold["expect_status"]
    if expect == "conflict":
        ok = (finding.status == Status.conflict
              and finding.conflict is not None
              and finding.conflict.resolver.value == gold.get("expect_resolver"))
        return "correct_conflict_with_resolver" if ok else "wrong"
    if expect == "not_found":
        return "correct_abstention" if finding.status == Status.not_found else "wrong"

    ok = finding.status.value == expect and _cites_ok(finding, gold.get("must_cite", []))
    return "correct_with_citation" if ok else "wrong"


def hallucination_rate(findings: list[Finding]) -> float:
    if not findings:
        return 0.0
    bad = sum(1 for f in findings if f.evidence and any(not e.verified for e in f.evidence))
    return bad / len(findings)
