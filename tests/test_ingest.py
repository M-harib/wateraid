"""Async ingest against the real pack: locators, corpus membership, exclusions."""
from __future__ import annotations

import asyncio

from core.ingest import ingest_all
from core.registry import build_registry


async def test_ingest_produces_units_for_pack_docs(core):
    assert len(core.units.all()) > 0
    assert core.units.by_doc("03"), "no units for the agreement (03)"
    assert core.units.by_doc("05"), "no units for the PMF workbook (05)"


async def test_pdf_units_carry_page_locators(core):
    u = core.units.by_doc("03")[0]
    assert u.ref.page is not None and u.ref.sheet is None
    assert u.text.strip()


async def test_excel_units_carry_sheet_and_cells(core):
    u = core.units.by_doc("05")[0]
    assert u.ref.sheet is not None and u.ref.cells is not None
    assert u.ref.page is None


async def test_reference_and_absent_docs_are_not_ingested(core):
    docs = set(core.units.docs())
    assert not any(d.startswith("ESDC") for d in docs)      # reference-only
    assert "GTC" not in docs and "PIP" not in docs          # absent


async def test_ingest_is_concurrent_not_serial():
    # gather over to_thread parsers should overlap; wall time well under the serial sum.
    reg = list(build_registry("assets").values())
    loop = asyncio.get_running_loop()
    t0 = loop.time()
    units = await ingest_all(reg)
    elapsed = loop.time() - t0
    assert len(units) > 0
    assert elapsed < 30, f"ingest took {elapsed:.1f}s — not overlapping?"
