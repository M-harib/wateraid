"""ComplianceAssistant: route -> load context -> draft (LLM) -> code checks ->
verify -> escalate gate -> stored finding. Async; the LLM is injected (FakeLLM offline)."""
from __future__ import annotations

import os

from core import Core, Finding, RunResult, normalize, route, run

from .config import CHECK_ADAPTERS, DEFAULT, KEYWORDS, TABLE
from .draft import SYSTEM, build_user, parse_finding


class ComplianceAssistant:
    def __init__(self, core: Core, llm) -> None:
        self.core = core
        self.llm = llm

    def _ctx(self, intent, question: str):
        """Rank units by term overlap with the question and cap total size, so the
        prompt stays small and fits provider per-request token limits."""
        units = []
        for doc_id in intent.docs:
            units.extend(self.core.units.by_doc(doc_id))  # "finding_store" yields none
        if not units:
            return units
        terms = {t for t in normalize(question).split() if len(t) > 2}
        budget = int(os.getenv("CTX_CHAR_BUDGET", "14000"))
        picked, total = [], 0
        for unit in sorted(units, key=lambda u: len(terms & set(normalize(u.text).split())), reverse=True):
            if picked and total + len(unit.text) > budget:
                break
            picked.append(unit)
            total += len(unit.text)
        picked.sort(key=lambda u: (u.doc_id, u.index))  # restore reading order
        return picked

    def _apply_checks(self, intent, finding: Finding) -> None:
        """Replace the model's proposed inputs with an authoritative Computed result."""
        if not finding.computed:
            return
        for name in intent.checks:
            adapter = CHECK_ADAPTERS.get(name)
            if not adapter:
                continue
            try:
                finding.computed = adapter(finding.computed.inputs)
            except (KeyError, ValueError, TypeError, ZeroDivisionError):
                continue
            return

    async def ask(self, question: str) -> RunResult:
        intent = route(question, KEYWORDS, TABLE, DEFAULT)
        units = self._ctx(intent, question)
        absent = self.core.absent()

        async def draft(tier: str, reason: str | None) -> Finding:
            raw = await self.llm.complete(
                tier=tier, system=SYSTEM,
                user=build_user(question, intent, units, absent, reason), json_mode=True,
            )
            finding = parse_finding(raw, topic=intent.name)
            self._apply_checks(intent, finding)
            return self.core.verify(finding)

        result = await run(intent.tier, draft)
        await self.core.findings.add(result.finding)
        return result
