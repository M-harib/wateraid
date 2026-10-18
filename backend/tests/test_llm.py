"""LLM client: FakeLLM for offline dev; OpenRouterLLM fails loudly without a key."""
from __future__ import annotations

import json

import pytest

from core import FakeLLM, OpenRouterLLM
from core.llm import LLM


async def test_fake_llm_returns_canned_string():
    llm = FakeLLM("hello")
    assert await llm.complete(tier="mini", system="s", user="u") == "hello"


async def test_fake_llm_callable_sees_tier():
    llm = FakeLLM(lambda tier, system, user: f"{tier}:{user}")
    assert await llm.complete(tier="strong", system="s", user="q") == "strong:q"


async def test_fakes_satisfy_the_protocol():
    assert isinstance(FakeLLM("x"), LLM)
    assert isinstance(OpenRouterLLM(api_key=""), LLM)


async def test_openrouter_requires_key():
    llm = OpenRouterLLM(api_key="")  # explicit empty -> no env fallback
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        await llm.complete(tier="mini", system="s", user="u")


def test_openrouter_bounds_requested_output(monkeypatch):
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self, *args):
            return b'{"choices":[{"message":{"content":"ok"}}]}'

    def fake_urlopen(request, timeout):
        captured.update(json.loads(request.data))
        return Response()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    llm = OpenRouterLLM(api_key="test", max_tokens=2048)
    assert llm._post("mini", "system", "user", True) == "ok"
    assert captured["max_tokens"] == 2048
    assert llm.max_tokens == {"mini": 2048, "strong": 2048}
    assert captured["response_format"] == {"type": "json_object"}


def test_openrouter_uses_tier_specific_output_limits(monkeypatch):
    monkeypatch.delenv("LLM_MINI_MAX_TOKENS", raising=False)
    monkeypatch.delenv("LLM_STRONG_MAX_TOKENS", raising=False)
    llm = OpenRouterLLM(api_key="test")
    assert llm.max_tokens == {"mini": 4096, "strong": 1024}


@pytest.mark.parametrize("value", [0, -1, True, 1.5])
def test_openrouter_rejects_invalid_max_tokens(value):
    with pytest.raises(ValueError, match="positive integer"):
        OpenRouterLLM(api_key="test", max_tokens=value)
