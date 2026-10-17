"""Rules router: question -> Intent; each tool supplies its own keywords/table."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Intent:
    name: str
    docs: tuple[str, ...]        # doc_ids to load into context
    checks: tuple[str, ...]      # deterministic check names to run
    tier: str                    # "mini" | "strong" (starting tier; gate may escalate)


def route(
    question: str,
    keywords: dict[str, tuple[str, ...]],
    table: dict[str, Intent],
    default: str,
) -> Intent:
    q = question.lower()
    for name, kws in keywords.items():
        if any(k in q for k in kws):
            return table[name]
    return table[default]
