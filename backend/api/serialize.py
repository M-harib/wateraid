"""Map core (snake_case) objects to the frontend's camelCase Zod shapes
(frontend/src/domain.ts + api.ts). The one place the two contracts meet."""
from __future__ import annotations

from datetime import date

from core import Finding, Status
from core.checks import score_urgency

AS_OF = date(2022, 6, 30)

PACK_DOCS = {"00", "01", "02", "03", "04", "05", "06"}  # frontend documentId enum


def _locator(ref) -> dict:
    loc = {}
    if ref.page is not None:
        loc["page"] = ref.page
    if ref.section:
        loc["section"] = ref.section
    if ref.sheet:
        loc["sheet"] = ref.sheet
    if ref.cells:
        loc["cells"] = ref.cells
    return loc


def _valid_locator(ref) -> bool:
    """The FE requires a page, a section, or sheet+cells on every evidence item."""
    return ref.page is not None or bool(ref.section) or bool(ref.sheet and ref.cells)


def _ev_id(ref) -> str:
    if ref.page is not None:
        return f"{ref.doc_id}:p{ref.page}"
    if ref.sheet and ref.cells:
        return f"{ref.doc_id}:{ref.sheet}!{ref.cells}"
    return f"{ref.doc_id}:{ref.section or 'ref'}"


def evidence_full(ev) -> dict:
    """Evidence for FindingSchema (id + version + verified)."""
    d = {"id": _ev_id(ev.ref), "documentId": ev.ref.doc_id, "version": ev.ref.version,
         "locator": _locator(ev.ref), "verified": ev.verified and bool(ev.quote)}
    if ev.quote:  # omit (never null) — the frontend's excerpt is optional string
        d["excerpt"] = ev.quote
    return d


def evidence_light(ev) -> dict:
    """Evidence for AnswerSchema (documentId + locator + excerpt)."""
    d = {"documentId": ev.ref.doc_id, "locator": _locator(ev.ref)}
    if ev.quote:
        d["excerpt"] = ev.quote
    return d


def evidence_dict_full(ev: dict) -> dict:
    """Serialized core Evidence -> frontend EvidenceSchema."""
    ref = ev["ref"]
    locator = {key: ref[key] for key in ("page", "section", "sheet", "cells") if ref.get(key) is not None}
    if ref.get("page") is not None:
        evidence_id = f'{ref["doc_id"]}:p{ref["page"]}'
    elif ref.get("sheet") and ref.get("cells"):
        evidence_id = f'{ref["doc_id"]}:{ref["sheet"]}!{ref["cells"]}'
    else:
        evidence_id = f'{ref["doc_id"]}:{ref.get("section") or "ref"}'
    result = {
        "id": evidence_id,
        "documentId": ref["doc_id"],
        "version": ref.get("version"),
        "locator": locator,
        "verified": bool(ev.get("verified")),
    }
    if ev.get("quote"):
        result["excerpt"] = ev["quote"]
    return result


def _priority(f: Finding) -> str:
    u = score_urgency(f, AS_OF)
    return "high" if u >= 100 else "medium" if u >= 30 else "low"


def _state(f: Finding) -> str:
    return "insufficient_evidence" if f.status == Status.not_found else "needs_review"


def _next_action(f: Finding) -> str:
    if f.conflict:
        return ("Refer to Global Affairs Canada to resolve." if f.conflict.resolver.value == "gac"
                else "Water Care staff to review and resolve.")
    if f.status == Status.not_found:
        return "Confirm whether the source exists outside the provided documents."
    return "Review the cited evidence."


def finding_to_issue(f: Finding) -> dict:
    """A stored Finding -> frontend FindingSchema (an action item for the dashboard)."""
    return {
        "id": f.id,
        "kind": f.topic,
        "title": f.topic.replace("_", " ").title(),
        "summary": f.claim or f.topic.replace("_", " ").title(),
        "priority": _priority(f),
        "state": _state(f),
        "nextAction": _next_action(f),
        "owner": f.conflict.resolver.value if f.conflict else None,
        "resolver": f.conflict.resolver.value if f.conflict else None,
        "dueOn": f.due.isoformat() if f.due else None,
        "evidence": [evidence_full(e) for e in f.evidence
                     if e.ref.doc_id in PACK_DOCS and _valid_locator(e.ref)],
    }


def issues_payload(findings: list[Finding]) -> list[dict]:
    """Findings that are action items (conflicts / needs-review) with pack evidence."""
    out = []
    for f in findings:
        if f.status not in (Status.conflict, Status.needs_review):
            continue
        issue = finding_to_issue(f)
        if issue["evidence"]:  # FindingSchema requires >= 1 evidence
            out.append(issue)
    return out


def finding_to_answer(f: Finding, allowed_docs: set | None = PACK_DOCS) -> dict:
    """Finding -> AnswerSchema; forces evidence/status to satisfy the FE contract.
    allowed_docs=None accepts any doc id (uploaded-project corpora)."""
    usable = [e for e in f.evidence
              if (allowed_docs is None or e.ref.doc_id in allowed_docs) and _valid_locator(e.ref)]
    evidence = [evidence_light(e) for e in usable]
    status = "answered" if f.status == Status.confirmed else f.status.value
    if status == "answered" and not evidence:
        status = "not_found"
    elif status == "conflict" and len(evidence) < 2:
        status = "needs_review"

    if not evidence or any(not e.verified for e in usable):
        confidence = {"level": "low", "reason": "The answer has incomplete or unverified source support."}
    elif status == "answered":
        confidence = {"level": "high", "reason": "The answer is supported by verified quotations from the supplied documents."}
    else:
        confidence = {"level": "medium", "reason": "Verified sources were found, but they conflict or require human interpretation."}

    computed_result = f.computed.result if f.computed and isinstance(f.computed.result, dict) else {}
    missing_information = [item for item in computed_result.get("missing_information", [])
                          if isinstance(item, str) and item.strip()]
    if status == "not_found" and not missing_information:
        searched = ", ".join(f.searched) if f.searched else "the available sources"
        missing_information.append(f"The information needed to answer was not found in {searched}.")
    elif status == "conflict" and f.conflict:
        missing_information.append(f.conflict.question)
    elif status == "needs_review":
        missing_information.append("The sources support only a qualified answer; human interpretation is still required.")

    conflicting = evidence if status == "conflict" else []
    supporting = [] if status == "conflict" else evidence
    return {
        "answer": f.claim or "No answer could be supported from the provided documents.",
        "status": status,
        "confidence": confidence,
        "supportingEvidence": supporting,
        "conflictingEvidence": conflicting,
        "missingInformation": missing_information,
        "suggestedNextAction": _next_action(f),
        "evidence": evidence,
    }


def checklist_rows_to_view(rows: list[dict]) -> list[dict]:
    """Proposal checklist rows -> camelCase browser view models."""
    return [{
        "id": row["id"],
        "category": row["category"],
        "requirement": row["requirement"],
        "status": row["status"],
        "reason": row["reason"],
        "evidence": [evidence_dict_full(ev) for ev in row.get("evidence", [])
                     if ev.get("ref", {}).get("doc_id") in PACK_DOCS],
        "searched": row.get("searched", []),
        "absentSources": row.get("absent_sources", []),
        "computed": row.get("computed"),
    } for row in rows]


def reviewer_rows_to_view(rows: list[dict]) -> list[dict]:
    """GAC-reviewer mappings -> camelCase browser view models."""
    return [{
        "question": evidence_dict_full(row["question"]),
        "proposal": [evidence_dict_full(ev) for ev in row.get("proposal", [])],
        "status": row["status"],
        "reason": row["reason"],
    } for row in rows]


def proposal_payload(findings: list[Finding]) -> dict:
    """Read the proposal views back out of the shared finding store."""
    proposal = [finding for finding in findings if finding.tool == "proposal"]
    checklist_rows: list[dict] = []
    reviewer_rows: list[dict] = []
    failures: list[str] = []
    for finding in proposal:
        result = finding.computed.result if finding.computed else {}
        if result.get("error"):
            label = finding.topic.replace("_", " ").title()
            failures.append(f"{label}: {finding.claim}")
        elif finding.topic == "checklist":
            checklist_rows = result.get("rows", [])
        elif finding.topic == "reviewer_mapping":
            reviewer_rows = result.get("rows", [])
    return {
        "findings": issues_payload(proposal),
        "checklist": checklist_rows_to_view(checklist_rows),
        "reviewerQuestions": reviewer_rows_to_view(reviewer_rows),
        "failures": failures,
    }
