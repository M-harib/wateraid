"""In-process progress tracking for the proposal review background job."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4


STEP_LABELS = {
    "cost_share_vs_call": "Compare cost-share requirements",
    "construction_vs_call": "Check construction activities",
    "unsupported_claims": "Review unsupported claims",
    "checklist": "Build call-requirements checklist",
    "reviewer_mapping": "Map GAC reviewer questions",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProposalRunTracker:
    """Own one resumable background run per API process."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._state = self._empty_state()

    @staticmethod
    def _empty_state() -> dict:
        return {
            "runId": None,
            "status": "idle",
            "completed": 0,
            "total": len(STEP_LABELS),
            "percent": 0,
            "steps": [
                {"id": step_id, "label": label, "status": "pending"}
                for step_id, label in STEP_LABELS.items()
            ],
            "startedAt": None,
            "finishedAt": None,
            "error": None,
        }

    def snapshot(self) -> dict:
        return {
            **self._state,
            "steps": [dict(step) for step in self._state["steps"]],
        }

    async def start(self, assistant) -> dict:
        if self._task and not self._task.done():
            return self.snapshot()
        self._state = self._empty_state()
        self._state.update({"runId": str(uuid4()), "status": "running", "startedAt": _now()})
        self._task = asyncio.create_task(self._run(assistant), name="proposal-review")
        return self.snapshot()

    async def _run(self, assistant) -> None:
        try:
            await assistant.startup(on_progress=self.update)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # unexpected orchestration failure; individual model failures are findings
            self._state.update({"status": "failed", "finishedAt": _now(), "error": str(exc)})
        else:
            self._state.update({"status": "completed", "finishedAt": _now(), "percent": 100})

    async def update(self, step_id: str, status: str) -> None:
        if step_id not in STEP_LABELS or status not in {"running", "completed", "failed"}:
            raise ValueError("Invalid proposal review progress update")
        step = next(item for item in self._state["steps"] if item["id"] == step_id)
        step["status"] = status
        completed = sum(item["status"] in {"completed", "failed"} for item in self._state["steps"])
        self._state["completed"] = completed
        self._state["percent"] = round(completed * 100 / self._state["total"])

    async def close(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)
