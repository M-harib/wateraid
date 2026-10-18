"""Shared fixtures — tests run against the real synthetic pack in assets/."""
from __future__ import annotations

import pytest_asyncio

from core import Core


@pytest_asyncio.fixture
async def core() -> Core:
    c = Core("assets")
    await c.load()
    return c
