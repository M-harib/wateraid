"""API endpoints via TestClient, offline (FakeLLM). Shapes match the FE contract."""
from __future__ import annotations

import json
from urllib.error import HTTPError

from fastapi.testclient import TestClient

from core import Core, FakeLLM
from api.main import create_app

CONFLICT = json.dumps({
    "status": "conflict", "claim": "The agreement and report disagree on the final report date.",
    "evidence": [{"doc_id": "03", "page": 3, "section": "Art.4", "quote": "September 30, 2023"},
                 {"doc_id": "04", "page": 8, "quote": "15 May 2023"}],
    "conflict": {"question": "final report due?", "resolver": "gac"},
})
CONFIRMED = json.dumps({
    "status": "confirmed", "claim": "Takes effect on the last signature date.",
    "evidence": [{"doc_id": "03", "page": 3,
                  "quote": "The Agreement shall take effect on the date of the last signature"}],
})


def _client(canned: str) -> TestClient:
    return TestClient(create_app(core=Core("assets"), llm=FakeLLM(canned)))


class RejectingLLM:
    async def complete(self, **kwargs):
        raise HTTPError("https://provider.invalid", 402, "payment required", {}, None)


def test_healthz():
    with _client(CONFIRMED) as c:
        assert c.get("/healthz").json() == {"ok": True}


def test_obligations_empty_list():
    with _client(CONFIRMED) as c:
        assert c.get("/obligations").json() == []


def test_ask_maps_confirmed_to_answered():
    with _client(CONFIRMED) as c:
        r = c.post("/ask", json={"question": "On what date did the agreement take effect?"})
        body = r.json()
        assert r.status_code == 200
        assert body["status"] == "answered" and body["evidence"][0]["documentId"] == "03"


def test_ask_requires_question():
    with _client(CONFIRMED) as c:
        assert c.post("/ask", json={"question": "  "}).status_code == 400


def test_findings_surfaces_stored_conflict_as_issue():
    with _client(CONFLICT) as c:
        c.post("/ask", json={"question": "When is the final results and operations report due? Is the agreement consistent on this?"})
        rows = c.get("/findings").json()
        assert rows and rows[0]["resolver"] == "gac"
        assert rows[0]["state"] == "needs_review"
        assert rows[0]["evidence"][0]["locator"]  # nested locator present


def test_fixtures_mode_returns_labelled_placeholder(monkeypatch):
    monkeypatch.setenv("GG_FIXTURES", "1")
    with _client(CONFIRMED) as c:
        rows = c.get("/findings").json()
        assert rows[0]["title"].startswith("CONTRACT EXAMPLE")
        assert c.post("/ask", json={"question": "anything"}).json()["status"] == "not_found"


def test_proposal_workspace_starts_empty_without_running_models():
    with _client(CONFIRMED) as c:
        body = c.get("/proposal").json()
        assert body == {"findings": [], "checklist": [], "reviewerQuestions": [], "failures": []}


def test_proposal_ask_abstains_for_known_absent_form():
    with _client(CONFIRMED) as c:
        response = c.post("/proposal/ask", json={"question": "Is the Local Partners form complete?"})
        assert response.status_code == 200
        assert response.json()["status"] == "not_found"
        assert response.json()["evidence"] == []


def test_proposal_ask_requires_question():
    with _client(CONFIRMED) as c:
        assert c.post("/proposal/ask", json={"question": " "}).status_code == 400


def test_proposal_provider_rejection_is_http_failure():
    with TestClient(create_app(core=Core("assets"), llm=RejectingLLM())) as c:
        response = c.post("/proposal/ask", json={"question": "Does the cost share meet the call?"})
        assert response.status_code == 503
        assert "credentials or credits" in response.json()["detail"]
