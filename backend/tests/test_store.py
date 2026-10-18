"""Async stores: unit lookup, finding CRUD, and concurrent-write safety."""
from __future__ import annotations

import asyncio

from core import Evidence, Finding, SourceRef, Status, Unit
from core.store import FindingStore, UnitStore


def _unit(doc_id, page, text="t"):
    return Unit(doc_id=doc_id, index=page, ref=SourceRef(doc_id, page=page), text=text)


def _finding(i):
    return Finding(id=f"f{i}", stable_key=f"k{i}", tool="t", topic="o",
                   claim="c", status=Status.confirmed)


async def test_unit_store_load_lookup_and_by_doc():
    s = UnitStore()
    await s.load([_unit("03", 1), _unit("03", 2), _unit("05", 1)])
    assert len(s.by_doc("03")) == 2
    assert set(s.docs()) == {"03", "05"}
    got = s.lookup(SourceRef("03", page=2))
    assert got is not None and got.index == 2
    assert s.lookup(SourceRef("03", page=99)) is None


async def test_finding_store_add_get_by_key():
    s = FindingStore()
    f = _finding(1)
    await s.add(f)
    assert s.get("f1") is f
    assert s.by_key("k1") is f
    assert s.get("missing") is None


async def test_finding_store_concurrent_writes_keep_all():
    s = FindingStore()
    await asyncio.gather(*(s.add(_finding(i)) for i in range(50)))
    assert len(s.all()) == 50
    assert {f.id for f in s.all()} == {f"f{i}" for i in range(50)}


async def test_add_many():
    s = FindingStore()
    await s.add_many([_finding(i) for i in range(5)])
    assert len(s.all()) == 5
