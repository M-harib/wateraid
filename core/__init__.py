"""Core: the funder-agnostic engine shared by the compliance and proposal tools."""
from __future__ import annotations

from pathlib import Path

from . import checks
from .dispatch import Intent, route
from .format import locator_label
from .ingest import ingest_all
from .llm import LLM, FakeLLM, OpenRouterLLM
from .pipeline import RunResult, run, validate
from .registry import build_registry
from .schema import (  # re-export the contract
    Computed,
    Conflict,
    DocRecord,
    Evidence,
    Finding,
    Obligation,
    Resolver,
    SourceRef,
    Status,
    Unit,
    to_dict,
)
from .store import FindingStore, UnitStore
from .verify import normalize, verify_finding, verify_quote

__all__ = [
    "Core", "Computed", "Conflict", "DocRecord", "Evidence", "Finding",
    "Obligation", "Resolver", "SourceRef", "Status", "Unit", "to_dict",
    "normalize", "verify_finding", "verify_quote",
    "checks", "Intent", "route", "locator_label",
    "LLM", "FakeLLM", "OpenRouterLLM", "RunResult", "run", "validate",
]


class Core:
    def __init__(self, assets_dir: str | Path = "assets") -> None:
        self.registry: dict[str, DocRecord] = build_registry(assets_dir)
        self.units = UnitStore()
        self.findings = FindingStore()

    async def load(self) -> int:
        """Ingest every in-corpus doc concurrently into the unit store."""
        units = await ingest_all(list(self.registry.values()))
        await self.units.load(units)
        return len(units)

    def doc(self, doc_id: str) -> DocRecord | None:
        return self.registry.get(doc_id)

    def absent(self) -> list[DocRecord]:
        """Known referenced-but-absent docs — for honest abstention."""
        return [r for r in self.registry.values() if not r.present]

    def verify(self, finding: Finding) -> Finding:
        return verify_finding(finding, self.units.lookup)
