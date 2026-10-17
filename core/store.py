"""In-memory async stores shared by every tool: the corpus and the findings."""
from __future__ import annotations

import asyncio

from .schema import Finding, SourceRef, Unit


def _key(ref: SourceRef) -> tuple:
    return (ref.doc_id, ref.page, ref.sheet, ref.cells)


class UnitStore:
    # ponytail: in-memory; lock guards writes only (asyncio reads don't race). DB if it outgrows memory.
    def __init__(self) -> None:
        self._by_doc: dict[str, list[Unit]] = {}
        self._by_ref: dict[tuple, Unit] = {}
        self._lock = asyncio.Lock()

    async def load(self, units) -> None:
        async with self._lock:
            for u in units:
                self._by_doc.setdefault(u.doc_id, []).append(u)
                self._by_ref[_key(u.ref)] = u

    def by_doc(self, doc_id: str) -> list[Unit]:
        return list(self._by_doc.get(doc_id, []))

    def docs(self) -> list[str]:
        return list(self._by_doc)

    def lookup(self, ref: SourceRef) -> Unit | None:
        """Resolve a SourceRef to its Unit (used by the quote verifier)."""
        return self._by_ref.get(_key(ref))

    def all(self) -> list[Unit]:
        return [u for units in self._by_doc.values() for u in units]


class FindingStore:
    def __init__(self) -> None:
        self._by_id: dict[str, Finding] = {}
        self._by_key: dict[str, Finding] = {}
        self._lock = asyncio.Lock()

    async def add(self, finding: Finding) -> None:
        async with self._lock:
            self._by_id[finding.id] = finding
            self._by_key[finding.stable_key] = finding

    async def add_many(self, findings) -> None:
        async with self._lock:
            for f in findings:
                self._by_id[f.id] = f
                self._by_key[f.stable_key] = f

    def get(self, finding_id: str) -> Finding | None:
        return self._by_id.get(finding_id)

    def by_key(self, stable_key: str) -> Finding | None:
        return self._by_key.get(stable_key)

    def all(self) -> list[Finding]:
        return list(self._by_id.values())
