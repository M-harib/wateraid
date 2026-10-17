"""Per-project document endpoints via TestClient (upload, tracker, ask, file, delete)."""
from __future__ import annotations

import json
import time

from fastapi.testclient import TestClient

from core import Core, FakeLLM
from api.main import create_app

CSV = b"name,role,note\nAfia,lead,owns the budget\nKofi,analyst,reviews reports\n"
NOT_FOUND = json.dumps({"status": "not_found", "claim": "Not in the documents.", "searched": ["x"]})


def _client(tmp_path, monkeypatch, canned=NOT_FOUND):
    monkeypatch.setenv("GG_DATA_DIR", str(tmp_path))
    return TestClient(create_app(core=Core("assets"), llm=FakeLLM(canned)))


def _wait_ready(client, pid, tries=100):
    for _ in range(tries):
        body = client.get(f"/projects/{pid}/documents").json()
        if body["ready"]:
            return body
        time.sleep(0.05)
    return client.get(f"/projects/{pid}/documents").json()


def test_upload_tracks_to_ready(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        r = c.post("/projects/demo/documents", files=[("files", ("team.csv", CSV, "text/csv"))])
        assert r.status_code == 202
        acc = r.json()["accepted"]
        assert len(acc) == 1 and acc[0]["status"] == "queued"
        body = _wait_ready(c, "demo")
        assert body["ready"] is True and body["documents"][0]["status"] == "ready"
        assert body["documents"][0]["unit_count"] == 3


def test_unsupported_type_rejected(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        r = c.post("/projects/demo/documents", files=[("files", ("notes.txt", b"hi", "text/plain"))])
        body = r.json()
        assert body["accepted"] == [] and len(body["rejected"]) == 1


def test_ask_requires_ready_docs(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        assert c.post("/projects/empty/ask", json={"question": "hi"}).status_code == 409


def test_ask_after_ready_returns_answer_shape(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        c.post("/projects/demo/documents", files=[("files", ("team.csv", CSV, "text/csv"))])
        _wait_ready(c, "demo")
        r = c.post("/projects/demo/ask", json={"question": "Who owns the budget?"})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] in {"answered", "conflict", "not_found", "needs_review"}
        assert "confidence" in body and "evidence" in body


def test_file_serve_and_delete(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        acc = c.post("/projects/demo/documents", files=[("files", ("team.csv", CSV, "text/csv"))]).json()["accepted"]
        doc_id = acc[0]["doc_id"]
        _wait_ready(c, "demo")
        f = c.get(f"/projects/demo/documents/{doc_id}/file")
        assert f.status_code == 200 and f.content == CSV
        assert c.delete(f"/projects/demo/documents/{doc_id}").status_code == 200
        assert c.get("/projects/demo/documents").json()["documents"] == []
        assert c.get(f"/projects/demo/documents/{doc_id}/file").status_code == 404
