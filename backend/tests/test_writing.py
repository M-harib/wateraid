"""Writing help: cited tips, pasteable sentences, placeholder and invented-figure guards (offline)."""
from __future__ import annotations

import json
from urllib.error import HTTPError

from fastapi.testclient import TestClient

from core import Core, FakeLLM
from api.main import create_app
from tools.proposal.writing import unsupported_numbers

REQUEST = {"heading": "Eligibility requirements", "body": "Water Care will provide the cost share.",
           "question": "What should I write about the cost share?"}


def _first(payload: dict, doc: str) -> dict:
    return next(unit for unit in payload["source_units"] if unit["unit_id"].startswith(doc + ":"))


def _quote(unit: dict) -> str:
    return " ".join(unit["text"].split()[:6])


def _responder(build):
    calls = []

    def respond(tier, system, user):
        payload = json.loads(user)
        calls.append(payload)
        return json.dumps(build(payload))
    respond.calls = calls
    return respond


def _client(responder) -> TestClient:
    return TestClient(create_app(core=Core("assets"), llm=FakeLLM(responder)))


def test_returns_cited_tips_and_sentences_with_placeholders():
    def build(payload):
        call = _first(payload, "01")
        return {
            "tips": [{"text": "State the cost share against the call.", "evidence": [{"unit_id": call["unit_id"], "quote": _quote(call)}]}],
            "sentences": [{"text": "Water Care will contribute [cash amount] in cash and [in-kind amount] in kind.",
                           "evidence": [{"unit_id": call["unit_id"], "quote": _quote(call)}]}],
            "missing_information": ["Cash and in-kind amounts"],
        }
    responder = _responder(build)
    with _client(responder) as client:
        response = client.post("/proposal/writing-help", json=REQUEST)
        assert response.status_code == 200
        data = response.json()
        assert data["tips"][0]["evidence"][0]["documentId"] == "01"
        assert data["tips"][0]["evidence"][0]["verified"] is True
        assert data["sentences"][0]["placeholders"] == ["cash amount", "in-kind amount"]
        assert data["missingInformation"] == ["Cash and in-kind amounts"]
        assert data["removed"] == []
        # Writing help is not a finding: nothing appears in the issue list.
        assert client.get("/findings").json() == []
        # Same page and request: served from cache without another model call.
        assert client.post("/proposal/writing-help", json=REQUEST).json() == data
    assert len(responder.calls) == 1
    payload = responder.calls[0]
    assert payload["draft_page"] == REQUEST["body"] and payload["request"] == REQUEST["question"]
    assert {unit["unit_id"].split(":")[0] for unit in payload["source_units"]} == {"01", "06"}


def test_drops_sentences_with_invented_figures_and_uncited_items():
    def build(payload):
        call = _first(payload, "01")
        good = {"unit_id": call["unit_id"], "quote": _quote(call)}
        return {
            "tips": [{"text": "Uncited tip.", "evidence": [{"unit_id": call["unit_id"], "quote": "text that is not on the page"}]},
                     {"text": "Cited tip.", "evidence": [good]}],
            "sentences": [{"text": "Water Care will contribute 37% of eligible costs.", "evidence": [good]},
                          {"text": "Water Care will contribute [percentage] of eligible costs.", "evidence": [good]}],
            "missing_information": [],
        }
    with _client(_responder(build)) as client:
        data = client.post("/proposal/writing-help", json=REQUEST).json()
    assert [tip["text"] for tip in data["tips"]] == ["Cited tip."]
    assert [item["text"] for item in data["sentences"]] == ["Water Care will contribute [percentage] of eligible costs."]
    assert len(data["removed"]) == 2 and any("37" in reason for reason in data["removed"])
    assert "problems" not in data


def test_repairs_once_then_reports_unavailable():
    responder = _responder(lambda payload: {"tips": [], "sentences": [], "missing_information": []})
    with _client(responder) as client:
        response = client.post("/proposal/writing-help", json=REQUEST)
    assert response.status_code == 503
    assert "Could not produce cited writing help" in response.json()["detail"]
    assert len(responder.calls) == 2 and responder.calls[1]["repair"]


def test_provider_rejection_is_reported_without_details():
    class Rejecting:
        async def complete(self, **kwargs):
            raise HTTPError("https://provider.invalid", 402, "payment required", {}, None)
    with TestClient(create_app(core=Core("assets"), llm=Rejecting())) as client:
        response = client.post("/proposal/writing-help", json=REQUEST)
    assert response.status_code == 503
    assert "credentials or credits" in response.json()["detail"]


def test_blank_question_is_rejected():
    with _client(_responder(lambda payload: {})) as client:
        assert client.post("/proposal/writing-help", json={**REQUEST, "question": "  "}).status_code == 400


def test_unsupported_numbers_ignores_placeholders_and_supported_values():
    assert unsupported_numbers("Contribute [10%] and 2,000,000 over 3 years.", "at least $2,000,000 for 3 years") == set()
    assert unsupported_numbers("Reach 4500 girls.", "girls in schools") == {"4500"}
    assert unsupported_numbers("For over fifteen years.", "for fifteen years") == set()
    assert unsupported_numbers("Serving twenty schools.", "schools") == {"twenty"}


def test_rejected_items_get_one_repair_and_best_result_wins():
    def build(payload):
        call = _first(payload, "01")
        good = {"unit_id": call["unit_id"], "quote": _quote(call)}
        if payload["repair"]:
            return {"tips": [{"text": "Cited tip.", "evidence": [good]}],
                    "sentences": [{"text": "Water Care will provide [amount].", "evidence": [good]}], "missing_information": []}
        return {"tips": [{"text": "Cited tip.", "evidence": [good]}],
                "sentences": [{"text": "Bad quote sentence.", "evidence": [{"unit_id": call["unit_id"], "quote": "not on the page"}]}],
                "missing_information": []}
    responder = _responder(build)
    with _client(responder) as client:
        data = client.post("/proposal/writing-help", json=REQUEST).json()
    assert len(responder.calls) == 2 and "Bad quote sentence" in responder.calls[1]["repair"]
    assert [item["text"] for item in data["sentences"]] == ["Water Care will provide [amount]."]
    assert data["removed"] == []


def test_drops_sentences_that_state_a_compliance_verdict():
    from tools.proposal.writing import _VERDICT
    assert _VERDICT.search("Water Care will meet the mandatory cost share requirement by contributing [amount].")
    assert _VERDICT.search("The tables will be detailed, meeting the funding call's expectations.")
    assert _VERDICT.search("Water Care is fully eligible.")
    assert not _VERDICT.search("Water Care will contribute [cash amount] of total eligible direct project costs.")
    assert _VERDICT.search("This aligns with Global Affairs Canada's requirement that applicants contribute.")
    assert _VERDICT.search("The commitment is distinct from partner funding, ensuring compliance with the call.")
    assert _VERDICT.search("Cash and in-kind contributions, ensuring alignment with the funding call requirements.")
    assert _VERDICT.search("No profit will be generated, adhering to the call's not-for-profit requirement.")
    assert not _VERDICT.search("The project will meet monthly with district officials.")


def test_draft_quotes_are_verified_against_the_draft_and_relabelled():
    def build(payload):
        call = _first(payload, "01")
        return {"tips": [{"text": "Say who provides the cost share.", "evidence": [{"unit_id": "DRAFT", "quote": "provide the cost share"}]},
                         {"text": "Mislabelled draft wording.", "evidence": [{"unit_id": call["unit_id"], "quote": "Water Care will provide"}]},
                         {"text": "Fake draft quote.", "evidence": [{"unit_id": "DRAFT", "quote": "not in the draft"}]}],
                "sentences": [], "missing_information": []}
    with _client(_responder(build)) as client:
        data = client.post("/proposal/writing-help", json=REQUEST).json()
    assert [(tip["text"], tip["draftQuotes"], tip["evidence"]) for tip in data["tips"]] == [
        ("Say who provides the cost share.", ["provide the cost share"], []),
        ("Mislabelled draft wording.", ["Water Care will provide"], []),
    ]
    assert any("Fake draft quote" in reason for reason in data["removed"])


def test_wrapped_provider_rejection_is_reported_as_a_credentials_problem():
    class WrappedRejecting:  # OpenRouterLLM raises RuntimeError from the HTTPError
        async def complete(self, **kwargs):
            try:
                raise HTTPError("https://provider.invalid", 401, "unauthorized", {}, None)
            except HTTPError as exc:
                raise RuntimeError("LLM provider HTTP 401: body with details") from exc
    with TestClient(create_app(core=Core("assets"), llm=WrappedRejecting())) as client:
        response = client.post("/proposal/writing-help", json=REQUEST)
    assert response.status_code == 503
    assert "credentials or credits" in response.json()["detail"]
    assert "body with details" not in response.json()["detail"]
