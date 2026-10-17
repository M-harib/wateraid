"""LLM client: FakeLLM for offline dev; OpenRouterLLM fails loudly without a key."""
from __future__ import annotations

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
