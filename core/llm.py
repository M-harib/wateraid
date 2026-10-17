"""Tiered async LLM client (OpenRouter) + FakeLLM so tools build and test offline."""
from __future__ import annotations

import asyncio
import json
import os
import urllib.request
from typing import Callable, Protocol, runtime_checkable

DEFAULT_MODELS = {
    "mini": os.getenv("LLM_MINI", "openai/gpt-4.1-mini"),
    "strong": os.getenv("LLM_STRONG", "openai/gpt-4.1"),
}


@runtime_checkable
class LLM(Protocol):
    async def complete(self, *, tier: str, system: str, user: str, json_mode: bool = False) -> str: ...


class OpenRouterLLM:
    def __init__(self, api_key: str | None = None, models: dict | None = None,
                 base_url: str = "https://openrouter.ai/api/v1/chat/completions") -> None:
        self.api_key = api_key if api_key is not None else os.getenv("OPENROUTER_API_KEY")
        self.models = models or DEFAULT_MODELS
        self.base_url = base_url

    async def complete(self, *, tier: str, system: str, user: str, json_mode: bool = False) -> str:
        # ponytail: urllib in a thread; httpx.AsyncClient if call concurrency outgrows the pool.
        return await asyncio.to_thread(self._post, tier, system, user, json_mode)

    def _post(self, tier: str, system: str, user: str, json_mode: bool) -> str:
        if not self.api_key:
            raise RuntimeError("OPENROUTER_API_KEY not set")
        payload: dict = {
            "model": self.models[tier],
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        req = urllib.request.Request(
            self.base_url, method="POST", data=json.dumps(payload).encode(),
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (fixed OpenRouter URL)
            data = json.load(resp)
        return data["choices"][0]["message"]["content"]


class FakeLLM:
    """Deterministic stub for tests/offline dev. ``responder`` is a string or a
    callable(tier, system, user) -> string."""
    def __init__(self, responder: str | Callable[[str, str, str], str]) -> None:
        self._responder = responder

    async def complete(self, *, tier: str, system: str, user: str, json_mode: bool = False) -> str:
        r = self._responder
        return r(tier, system, user) if callable(r) else r
