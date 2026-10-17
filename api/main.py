"""FastAPI app exposing the dashboard endpoints, with CORS.
The web framework lives only here; core stays framework-agnostic.

Run: uv run python -m api.main   (serves on http://localhost:8010; set PORT to override)
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from core import Core, OpenRouterLLM
from tools.compliance import ComplianceAssistant
from tools.proposal import ProposalAssistant

from .fixtures import FIXTURE_ANSWER, FIXTURE_FINDINGS
from .proposal_run import ProposalRunTracker
from .serialize import (
    checklist_rows_to_view,
    finding_to_answer,
    issues_payload,
    proposal_payload,
    reviewer_rows_to_view,
)


def _origins() -> list[str]:
    raw = os.getenv(
        "GG_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


def _fixtures() -> bool:
    return os.getenv("GG_FIXTURES") == "1"


class AskRequest(BaseModel):
    question: str


class ProposalAskRequest(BaseModel):
    question: str
    documentIds: list[str] | None = Field(default=None, min_length=1, max_length=6)


def create_app(*, core: Core | None = None, llm=None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        load_dotenv()  # Load local .env for direct uvicorn/Makefile runs; shell values win.
        c = core or Core("assets")
        if not c.units.docs():                      # load once, in this event loop
            await c.load()
        model = llm or OpenRouterLLM()
        app.state.core = c
        app.state.assistant = ComplianceAssistant(c, model)
        app.state.proposal = ProposalAssistant(c, model)
        app.state.proposal_run = ProposalRunTracker()
        try:
            yield
        finally:
            await app.state.proposal_run.close()

    app = FastAPI(title="Grant Compliance API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=_origins(),
        allow_methods=["GET", "POST"], allow_headers=["*"],
    )

    @app.get("/healthz")
    async def healthz():
        return {"ok": True}

    @app.get("/findings")
    async def findings(request: Request):
        if _fixtures():
            return FIXTURE_FINDINGS
        return issues_payload(request.app.state.assistant.core.findings.all())

    @app.get("/obligations")
    async def obligations():
        return []  # ledger not built yet; the dashboard degrades gracefully

    @app.post("/ask")
    async def ask(request: Request):
        body = await request.json()
        question = (body or {}).get("question", "").strip()
        if not question:
            return JSONResponse({"detail": "question is required"}, status_code=400)
        if _fixtures():
            return FIXTURE_ANSWER
        try:
            result = await request.app.state.assistant.ask(question)
        except RuntimeError as exc:  # e.g. OPENROUTER_API_KEY not set
            return JSONResponse({"detail": str(exc)}, status_code=503)
        return finding_to_answer(result.finding)

    @app.get("/proposal")
    async def proposal_workspace(request: Request):
        """Return cached proposal views without starting a model run."""
        return proposal_payload(request.app.state.core.findings.all())

    @app.post("/proposal/ask")
    async def proposal_ask(request: Request, body: ProposalAskRequest):
        question = body.question.strip()
        if not question:
            return JSONResponse({"detail": "question is required"}, status_code=400)
        try:
            finding = await request.app.state.proposal.chat_finding(question, body.documentIds)
        except ValueError as exc:
            return JSONResponse({"detail": str(exc)}, status_code=400)
        if finding.computed and finding.computed.result.get("error"):
            return JSONResponse({"detail": finding.claim}, status_code=503)
        return finding_to_answer(finding)

    @app.post("/proposal/run", status_code=202)
    async def proposal_run(request: Request):
        """Start the review in the background and return immediately."""
        return await request.app.state.proposal_run.start(request.app.state.proposal)

    @app.get("/proposal/run/status")
    async def proposal_run_status(request: Request):
        return request.app.state.proposal_run.snapshot()

    @app.get("/proposal/checklist")
    async def proposal_checklist(request: Request):
        rows = await request.app.state.proposal.checklist()
        return checklist_rows_to_view(rows)

    @app.get("/proposal/reviewer-questions")
    async def proposal_reviewer_questions(request: Request):
        rows = await request.app.state.proposal.reviewer_questions()
        return reviewer_rows_to_view(rows)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", port=int(os.getenv("PORT", "8010")), reload=True)
