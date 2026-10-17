"""Background proposal review progress is observable and resumable."""
import asyncio

from api.proposal_run import ProposalRunTracker, STEP_LABELS


async def test_tracker_reports_each_async_step_and_reuses_active_run():
    release = asyncio.Event()

    class Assistant:
        async def startup(self, on_progress):
            for index, step in enumerate(STEP_LABELS):
                await on_progress(step, "running")
                if index == 0:
                    await release.wait()
                await on_progress(step, "completed")

    tracker = ProposalRunTracker()
    started = await tracker.start(Assistant())
    await asyncio.sleep(0)
    active = await tracker.start(Assistant())
    assert started["runId"] == active["runId"]
    assert tracker.snapshot()["status"] == "running"
    assert tracker.snapshot()["steps"][0]["status"] == "running"

    release.set()
    while tracker.snapshot()["status"] == "running":
        await asyncio.sleep(0)
    finished = tracker.snapshot()
    assert finished["status"] == "completed"
    assert finished["completed"] == finished["total"] == 5
    assert finished["percent"] == 100


async def test_tracker_surfaces_unexpected_orchestration_failure():
    class Assistant:
        async def startup(self, on_progress):
            await on_progress("checklist", "running")
            raise RuntimeError("unexpected failure")

    tracker = ProposalRunTracker()
    await tracker.start(Assistant())
    while tracker.snapshot()["status"] == "running":
        await asyncio.sleep(0)
    assert tracker.snapshot()["status"] == "failed"
    assert tracker.snapshot()["error"] == "unexpected failure"
