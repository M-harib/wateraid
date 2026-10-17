"""Draft prompt + JSON->Finding parser. The model quotes verbatim and proposes raw
inputs; it never computes numbers or resolves conflicts."""
from __future__ import annotations

import hashlib
import json

from core import Computed, Conflict, Evidence, Finding, Resolver, SourceRef, Status, locator_label

SYSTEM = """You are a grant compliance analyst for Water Care's GAC contribution agreement.
Answer ONLY from the provided source units. Rules:
- Cite every claim with a verbatim quote copied EXACTLY from a provided unit, plus its doc_id and locator (page, or sheet+cells).
- Never invent obligations, figures, dates or results. If the answer is not in the provided units, set status "not_found" and list the doc_ids you searched in "searched". If the answer lives in a listed ABSENT source, say so in "claim" and set status "not_found".
- When sources disagree, do NOT resolve it: set status "conflict", put BOTH sides in evidence, and name who must resolve it in conflict.resolver ("gac" or "water_care_staff"). Precedence is context only.
- Do NOT compute dates, sums, percentages or thresholds. If arithmetic is needed, extract the raw inputs into "computed_inputs" and narrate qualitatively in "claim"; code computes the result.
Return ONLY a JSON object:
{"status":"confirmed|conflict|not_found|needs_review","claim":"...","evidence":[{"doc_id":"03","page":3,"section":"Art.3","quote":"..."}],"conflict":{"question":"...","resolver":"gac"} or null,"computed_inputs":{...} or null,"searched":["03","04"]}"""


def build_user(question: str, intent, units, absent, reason: str | None = None) -> str:
    ctx = "\n\n".join(f"[{locator_label(u.ref)}]\n{u.text}" for u in units)
    absent_s = "; ".join(f"{a.doc_id} ({a.governs})" for a in absent) or "none"
    parts = [f"QUESTION: {question}",
             f"ABSENT SOURCES (not in corpus — abstain if the answer lives here): {absent_s}",
             f"SOURCE UNITS:\n{ctx}"]
    if reason:
        parts.insert(1, f"FIX from your previous attempt: {reason}. Re-extract exact quotes and valid JSON.")
    return "\n\n".join(parts)


def _enum(cls, value, default):
    try:
        return cls(value)
    except (ValueError, TypeError):
        return default


def stable_key(topic: str, evidence: list[Evidence]) -> str:
    locs = sorted(locator_label(e.ref) for e in evidence)
    digest = hashlib.sha1("|".join([topic, *locs]).encode()).hexdigest()[:12]
    return f"c:{topic}:{digest}"


def parse_finding(raw: str, topic: str) -> Finding:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        data = None
    if not isinstance(data, dict):
        return Finding(id=f"c:{topic}:malformed", stable_key=f"c:{topic}:malformed",
                       tool="compliance", topic=topic, claim=(raw or "")[:200], status=Status.needs_review)

    evidence = [
        Evidence(ref=SourceRef(doc_id=e["doc_id"], page=e.get("page"), sheet=e.get("sheet"),
                               cells=e.get("cells"), section=e.get("section")),
                 quote=e.get("quote", ""))
        for e in data.get("evidence", []) if e.get("doc_id")
    ]
    conflict = None
    c = data.get("conflict")
    if isinstance(c, dict) and c.get("resolver"):
        conflict = Conflict(question=c.get("question", ""),
                            resolver=_enum(Resolver, c["resolver"], Resolver.gac),
                            precedence_note=c.get("precedence_note"))
    computed = Computed(inputs=data["computed_inputs"], result=None) if data.get("computed_inputs") else None
    key = stable_key(topic, evidence)
    return Finding(
        id=key, stable_key=key, tool="compliance", topic=topic,
        claim=(data.get("claim") or "").strip(),
        status=_enum(Status, data.get("status"), Status.needs_review),
        evidence=evidence, conflict=conflict, computed=computed,
        searched=data.get("searched", []),
    )
