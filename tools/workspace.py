"""General grounded Q&A over a project's uploaded documents (no fixed-pack dispatch)."""
from __future__ import annotations

import hashlib
import json
import os

from core import (
    Conflict,
    Evidence,
    Finding,
    Resolver,
    SourceRef,
    Status,
    locator_label,
    normalize,
    run,
    verify_finding,
)

SYSTEM = """You are a research assistant that ANSWERS the user's question strictly from their uploaded documents.
Write the answer in your own words as a direct, self-contained statement. Do NOT restate or echo the question back.
- "claim" MUST be the answer itself (1-4 sentences). When documents disagree, say what each one states and how they differ.
- Cite every statement with a verbatim quote copied EXACTLY from a provided source unit, plus its doc_id and locator (page, or sheet+cells).
- Never invent facts. If the documents do not answer, set status "not_found", write a one-line "claim" saying so, and list the doc_ids you searched in "searched".
- When sources disagree, set status "conflict", include BOTH sides in evidence, and put the point of disagreement in "conflict_question".
Return ONLY a JSON object:
{"status":"confirmed|conflict|not_found|needs_review","claim":"<your answer>","conflict_question":"...","evidence":[{"doc_id":"...","page":1,"sheet":"...","cells":"...","section":"...","quote":"..."}],"searched":["..."]}"""


def _parse(raw: str) -> Finding:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        data = None
    if not isinstance(data, dict):
        return Finding(id="w:malformed", stable_key="w:malformed", tool="workspace",
                       topic="chat", claim=(raw or "")[:200], status=Status.needs_review)
    evidence = [
        Evidence(ref=SourceRef(doc_id=e["doc_id"], page=e.get("page"), sheet=e.get("sheet"),
                               cells=e.get("cells"), section=e.get("section")),
                 quote=e.get("quote", ""))
        for e in data.get("evidence", []) if e.get("doc_id")
    ]
    try:
        status = Status(data.get("status", "needs_review"))
    except ValueError:
        status = Status.needs_review
    key = "w:" + hashlib.sha1("|".join(sorted(locator_label(e.ref) for e in evidence)).encode()).hexdigest()[:12]
    # general QA has no precedence rules; a conflict just needs a human to interpret the sources
    conflict = (Conflict(question=(data.get("conflict_question") or "The sources disagree; review both.").strip(),
                         resolver=Resolver.water_care)
                if status == Status.conflict else None)
    return Finding(id=key, stable_key=key, tool="workspace", topic="chat",
                   claim=(data.get("claim") or "").strip(), status=status,
                   evidence=evidence, conflict=conflict, searched=data.get("searched", []))


class WorkspaceAssistant:
    def __init__(self, corpus, llm) -> None:
        self.corpus = corpus
        self.llm = llm

    def _ctx(self, question: str):
        units = self.corpus.units.all()
        if not units:
            return []
        terms = {t for t in normalize(question).split() if len(t) > 2}
        budget = int(os.getenv("CTX_CHAR_BUDGET", "14000"))
        picked, total = [], 0
        for unit in sorted(units, key=lambda u: len(terms & set(normalize(u.text).split())), reverse=True):
            if picked and total + len(unit.text) > budget:
                break
            picked.append(unit)
            total += len(unit.text)
        picked.sort(key=lambda u: (u.doc_id, u.index))
        return picked

    async def ask(self, question: str) -> Finding:
        units = self._ctx(question)
        ctx = "\n\n".join(f"[{locator_label(u.ref)}]\n{u.text}" for u in units)

        async def draft(tier: str, reason: str | None) -> Finding:
            user = f"QUESTION: {question}\n\nSOURCE UNITS:\n{ctx}"
            if reason:
                user = f"FIX from your previous attempt: {reason}. Re-extract exact quotes and valid JSON.\n\n{user}"
            raw = await self.llm.complete(tier=tier, system=SYSTEM, user=user, json_mode=True)
            return verify_finding(_parse(raw), self.corpus.units.lookup)

        result = await run("mini", draft)
        await self.corpus.findings.add(result.finding)
        return result.finding
