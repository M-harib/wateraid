"""Serializers emit the frontend's camelCase shapes (domain.ts / api.ts)."""
from __future__ import annotations

from core import Conflict, Evidence, Finding, Resolver, SourceRef, Status
from api.serialize import (
    checklist_rows_to_view,
    evidence_full,
    finding_to_answer,
    finding_to_issue,
    issues_payload,
    reviewer_rows_to_view,
)


def _ev(doc, page=None, sheet=None, cells=None, quote="q", verified=True):
    return Evidence(ref=SourceRef(doc, page=page, sheet=sheet, cells=cells), quote=quote, verified=verified)


def _f(status, **kw):
    base = dict(id="i", stable_key="k", tool="compliance", topic="report_consistency", claim="c")
    return Finding(status=status, **{**base, **kw})


def test_evidence_full_nests_locator_and_keeps_version_null():
    d = evidence_full(_ev("03", page=16))
    assert d["documentId"] == "03" and d["locator"] == {"page": 16}
    assert d["version"] is None and d["verified"] is True and d["excerpt"] == "q"
    assert d["id"] == "03:p16"


def test_excerpt_omitted_when_empty_not_null():
    d = evidence_full(_ev("03", page=1, quote="", verified=False))
    assert "excerpt" not in d  # frontend excerpt is optional string, never null


def test_excel_locator_and_id():
    d = evidence_full(_ev("05", sheet="PMF", cells="A5:L5"))
    assert d["locator"] == {"sheet": "PMF", "cells": "A5:L5"} and d["id"] == "05:PMF!A5:L5"


def test_finding_to_issue_shape_and_resolver():
    f = _f(Status.conflict, evidence=[_ev("03", page=3), _ev("04", page=8)],
           conflict=Conflict("final report due?", Resolver.gac))
    issue = finding_to_issue(f)
    assert issue["state"] == "needs_review" and issue["resolver"] == "gac"
    assert issue["priority"] in {"high", "medium", "low"}
    assert issue["title"] and issue["summary"] and issue["nextAction"]
    assert len(issue["evidence"]) == 2


def test_issues_payload_excludes_confirmed_and_evidenceless():
    confirmed = _f(Status.confirmed, evidence=[_ev("03", page=3)])
    conflict = _f(Status.conflict, evidence=[_ev("03", page=3), _ev("04", page=8)],
                  conflict=Conflict("q", Resolver.gac))
    abstention = _f(Status.not_found, searched=["03"])  # no evidence
    rows = issues_payload([confirmed, conflict, abstention])
    assert len(rows) == 1 and rows[0]["resolver"] == "gac"


def test_answer_maps_confirmed_to_answered():
    f = _f(Status.confirmed, evidence=[_ev("03", page=3)])
    ans = finding_to_answer(f)
    assert ans["status"] == "answered" and ans["answer"] == "c"
    assert ans["evidence"][0]["documentId"] == "03" and "id" not in ans["evidence"][0]
    assert ans["confidence"]["level"] == "high"
    assert ans["supportingEvidence"] == ans["evidence"]
    assert ans["conflictingEvidence"] == []
    assert ans["missingInformation"] == []
    assert ans["suggestedNextAction"]


def test_conflict_answer_separates_conflicting_evidence_and_human_action():
    f = _f(Status.conflict, evidence=[_ev("03", page=3), _ev("04", page=8)],
           conflict=Conflict("Which deadline applies?", Resolver.gac))
    ans = finding_to_answer(f)
    assert ans["confidence"]["level"] == "medium"
    assert ans["supportingEvidence"] == []
    assert ans["conflictingEvidence"] == ans["evidence"]
    assert ans["missingInformation"] == ["Which deadline applies?"]
    assert "Global Affairs Canada" in ans["suggestedNextAction"]


def test_not_found_answer_explains_missing_information_with_low_confidence():
    f = _f(Status.not_found, searched=["01", "02"])
    ans = finding_to_answer(f)
    assert ans["confidence"]["level"] == "low"
    assert "01, 02" in ans["missingInformation"][0]
    assert ans["supportingEvidence"] == ans["conflictingEvidence"] == []


def test_proposal_checklist_row_maps_nested_evidence_and_absent_sources():
    evidence = {"ref": {"doc_id": "01", "version": "synthetic", "page": 2},
                "quote": "Applicants must be eligible.", "verified": True}
    rows = checklist_rows_to_view([{
        "id": "row-1", "category": "eligibility", "requirement": "Eligible applicant",
        "status": "unclear", "reason": "Review required.", "evidence": [evidence],
        "searched": ["02:p1"], "absent_sources": ["LOCAL_PARTNERS"], "computed": None,
    }])
    assert rows[0]["evidence"][0]["documentId"] == "01"
    assert rows[0]["absentSources"] == ["LOCAL_PARTNERS"]


def test_reviewer_mapping_uses_full_evidence_shape():
    question = {"ref": {"doc_id": "06", "version": None, "sheet": "Review", "cells": "A2"},
                "quote": "How will delivery work?", "verified": True}
    proposal = {"ref": {"doc_id": "02", "version": None, "page": 1},
                "quote": "Delivery is described here.", "verified": True}
    rows = reviewer_rows_to_view([{"question": question, "proposal": [proposal],
                                   "status": "mapped", "reason": "Section C addresses it."}])
    assert rows[0]["question"]["locator"] == {"sheet": "Review", "cells": "A2"}
    assert rows[0]["proposal"][0]["documentId"] == "02"


# --- FE-contract guarantees (status/evidence can never break AnswerSchema) ---

def test_answer_downgrades_to_not_found_when_no_usable_evidence():
    # confirmed, but the only evidence has no locator -> dropped -> must not stay "answered"
    f = _f(Status.confirmed, evidence=[_ev("03")])  # no page/section/sheet+cells
    ans = finding_to_answer(f)
    assert ans["evidence"] == [] and ans["status"] == "not_found"


def test_answer_downgrades_conflict_with_one_evidence_to_needs_review():
    f = _f(Status.conflict, evidence=[_ev("03", page=3)],
           conflict=Conflict("q", Resolver.gac))
    ans = finding_to_answer(f)
    assert len(ans["evidence"]) == 1 and ans["status"] == "needs_review"


def test_answer_keeps_conflict_with_two_evidence():
    f = _f(Status.conflict, evidence=[_ev("03", page=3), _ev("04", page=8)],
           conflict=Conflict("q", Resolver.gac))
    ans = finding_to_answer(f)
    assert ans["status"] == "conflict" and len(ans["evidence"]) == 2


def test_answer_drops_evidence_without_locator():
    f = _f(Status.confirmed, evidence=[_ev("03", page=3), _ev("04")])  # second has no locator
    ans = finding_to_answer(f)
    assert [e["documentId"] for e in ans["evidence"]] == ["03"]


def test_issue_drops_evidence_without_locator():
    f = _f(Status.conflict, topic="report_consistency",
           evidence=[_ev("03", page=3), _ev("04")], conflict=Conflict("q", Resolver.gac))
    issue = finding_to_issue(f)
    assert all(e["locator"] for e in issue["evidence"]) and len(issue["evidence"]) == 1


def test_evidence_full_verified_requires_excerpt():
    # verified with no quote would break FE EvidenceSchema -> force verified False
    d = evidence_full(_ev("03", page=3, quote="", verified=True))
    assert d["verified"] is False and "excerpt" not in d
