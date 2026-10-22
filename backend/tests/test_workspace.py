"""Per-project workspace: ingest (csv/pdf), status tracker, persistence, ask, delete."""
from __future__ import annotations

import json

from core import FakeLLM, Status
from core.workspace import ProjectCorpus, Workspace
from tools.workspace import WorkspaceAssistant

CSV = b"name,role,note\nAfia,lead,owns the budget\nKofi,analyst,reviews reports\n"


async def _corpus(tmp_path, name="p1"):
    return ProjectCorpus(name, tmp_path / name)


async def test_upload_csv_ingests_to_ready(tmp_path):
    c = await _corpus(tmp_path)
    meta = await c.add_file("team.csv", CSV)
    assert meta.status == "queued" and meta.kind == "csv"
    await c.ingest(meta.doc_id)
    assert c.docs[meta.doc_id].status == "ready"
    assert c.docs[meta.doc_id].unit_count == 3  # header + 2 rows
    assert c.ready() is True
    # units are queryable and carry a usable locator
    units = c.units.by_doc(meta.doc_id)
    assert units and units[0].ref.sheet == "CSV" and units[0].ref.cells


async def test_unsupported_type_rejected(tmp_path):
    c = await _corpus(tmp_path)
    try:
        await c.add_file("notes.txt", b"hello")
        assert False, "expected ValueError"
    except ValueError:
        pass


async def test_ingest_failure_marks_failed(tmp_path):
    c = await _corpus(tmp_path)
    meta = await c.add_file("broken.pdf", b"not a real pdf")
    await c.ingest(meta.doc_id)
    assert c.docs[meta.doc_id].status == "failed" and c.docs[meta.doc_id].error


async def test_persistence_reingests_on_load(tmp_path):
    c = await _corpus(tmp_path)
    meta = await c.add_file("team.csv", CSV)
    await c.ingest(meta.doc_id)
    assert (tmp_path / "p1" / "documents.json").exists()
    # a fresh corpus over the same dir restores docs and rebuilds units
    c2 = ProjectCorpus("p1", tmp_path / "p1")
    await c2.load()
    assert c2.docs[meta.doc_id].status == "ready"
    assert len(c2.units.by_doc(meta.doc_id)) == 3


async def test_remove_drops_file_units_and_meta(tmp_path):
    c = await _corpus(tmp_path)
    meta = await c.add_file("team.csv", CSV)
    await c.ingest(meta.doc_id)
    assert await c.remove(meta.doc_id) is True
    assert meta.doc_id not in c.docs
    assert c.units.by_doc(meta.doc_id) == []
    assert c.path_for(meta.doc_id) is None
    assert await c.remove("nope") is False


async def test_workspace_get_or_create_and_load_all(tmp_path):
    ws = Workspace(data_dir=tmp_path)
    c = await ws.project("My Project!")       # sanitized id
    meta = await c.add_file("team.csv", CSV)
    await c.ingest(meta.doc_id)
    ws2 = Workspace(data_dir=tmp_path)
    await ws2.load_all()
    restored = await ws2.project("My Project!")
    assert restored.ready() and restored.docs[meta.doc_id].status == "ready"


async def test_ask_over_uploaded_corpus_verifies_quote(tmp_path):
    c = await _corpus(tmp_path)
    meta = await c.add_file("team.csv", CSV)
    await c.ingest(meta.doc_id)
    doc = meta.doc_id
    cells = c.units.by_doc(doc)[1].ref.cells  # row for "Afia"
    canned = json.dumps({
        "status": "confirmed", "claim": "Afia owns the budget.",
        "evidence": [{"doc_id": doc, "sheet": "CSV", "cells": cells, "quote": "owns the budget"}],
    })
    finding = await WorkspaceAssistant(c, FakeLLM(canned)).ask("Who owns the budget?")
    assert finding.status == Status.confirmed and finding.evidence[0].verified is True


async def test_ask_fabricated_quote_downgrades(tmp_path):
    c = await _corpus(tmp_path)
    meta = await c.add_file("team.csv", CSV)
    await c.ingest(meta.doc_id)
    canned = json.dumps({
        "status": "confirmed", "claim": "made up",
        "evidence": [{"doc_id": meta.doc_id, "sheet": "CSV", "cells": "A1:C1",
                      "quote": "this text is not anywhere in the csv"}],
    })
    finding = await WorkspaceAssistant(c, FakeLLM(canned)).ask("anything")
    assert finding.status == Status.needs_review and finding.evidence[0].verified is False


async def test_delete_refuses_paths_outside_the_project_folder(tmp_path):
    from core.workspace import Workspace
    ws = Workspace(tmp_path)
    (tmp_path / "projects").mkdir()
    (tmp_path / "keep.txt").write_text("keep")
    for bad in ("..", ".", "../..", "a/../.."):
        assert await ws.delete(bad) is False
    assert (tmp_path / "keep.txt").exists() and (tmp_path / "projects").exists()
