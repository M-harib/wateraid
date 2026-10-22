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


def test_projects_list_and_create(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        assert c.get("/projects").json()["projects"] == []
        r = c.post("/projects", json={"name": "GAC 2024 Round"})
        assert r.status_code == 201
        assert r.json() == {"projectId": "gac-2024-round", "name": "GAC 2024 Round"}
        listed = c.get("/projects").json()["projects"]
        assert listed == [{"projectId": "gac-2024-round", "name": "GAC 2024 Round", "documentCount": 0, "ready": False}]
        assert c.post("/projects", json={"name": "  "}).status_code == 400


def test_created_project_name_persists_and_counts(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        c.post("/projects", json={"name": "Coastal WASH"})
        c.post("/projects/coastal-wash/documents", files=[("files", ("team.csv", CSV, "text/csv"))])
        _wait_ready(c, "coastal-wash")
        row = next(p for p in c.get("/projects").json()["projects"] if p["projectId"] == "coastal-wash")
        assert row["name"] == "Coastal WASH" and row["documentCount"] == 1 and row["ready"] is True


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


def test_rename_project_keeps_id_and_persists(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        created = c.post("/projects", json={"name": "Coastal WASH"}).json()
        pid = created["projectId"]
        r = c.patch(f"/projects/{pid}", json={"name": "  Coastal   WASH 2026 "})
        assert r.status_code == 200
        assert r.json() == {"projectId": pid, "name": "Coastal WASH 2026", "documentCount": 0, "ready": False}
        assert {"projectId": pid, "name": "Coastal WASH 2026", "documentCount": 0, "ready": False} in c.get("/projects").json()["projects"]
        assert c.patch(f"/projects/{pid}", json={"name": "   "}).status_code == 400
        assert c.patch(f"/projects/{pid}", json={"name": "x" * 121}).status_code == 400
    # A fresh app reloads the saved name from disk.
    with _client(tmp_path, monkeypatch) as c:
        assert any(p["projectId"] == pid and p["name"] == "Coastal WASH 2026" for p in c.get("/projects").json()["projects"])


def test_rename_unlisted_project_creates_it_with_the_new_name(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        assert c.patch("/projects/taps-for-rights", json={"name": "Taps for Rights"}).json()["name"] == "Taps for Rights"
        assert [p["name"] for p in c.get("/projects").json()["projects"]] == ["Taps for Rights"]


def test_delete_project_removes_its_files(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as c:
        pid = c.post("/projects", json={"name": "Old pilot"}).json()["projectId"]
        c.post(f"/projects/{pid}/documents", files=[("files", ("team.csv", CSV, "text/csv"))])
        _wait_ready(c, pid)
        root = tmp_path / "projects" / pid
        assert root.exists()
        r = c.delete(f"/projects/{pid}")
        assert r.status_code == 200 and r.json()["deleted"] == pid
        assert not root.exists()
        assert all(p["projectId"] != pid for p in c.get("/projects").json()["projects"])
        assert c.delete(f"/projects/{pid}").status_code == 404
    # Nothing comes back after a restart.
    with _client(tmp_path, monkeypatch) as c:
        assert all(p["projectId"] != pid for p in c.get("/projects").json()["projects"])


def test_delete_cannot_escape_the_data_dir(tmp_path, monkeypatch):
    outside = tmp_path / "keep.txt"
    outside.write_text("keep")
    with _client(tmp_path, monkeypatch) as c:
        assert c.delete("/projects/..").status_code == 404
        assert c.delete("/projects/%2E%2E%2F").status_code in {404, 405}
    assert outside.exists()
