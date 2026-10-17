"""ComplianceAssistant: route -> load context -> draft (LLM) -> code checks ->
verify -> escalate gate -> stored finding. Async; the LLM is injected (FakeLLM offline)."""
from __future__ import annotations

from core import Core, Finding, RunResult, route, run

from .config import CHECK_ADAPTERS, DEFAULT, KEYWORDS, TABLE
from .draft import SYSTEM, build_user, parse_finding


class ComplianceAssistant:
    def __init__(self, core: Core, llm) -> None:
        self.core = core
        self.llm = llm

    def _ctx(self, intent):
        units = []
        for doc_id in intent.docs:
            units.extend(self.core.units.by_doc(doc_id))  # "finding_store" yields none
        return units

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
        units = self._ctx(intent)
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
