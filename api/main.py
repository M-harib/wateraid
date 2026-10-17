"""FastAPI app exposing the three endpoints the frontend calls, with CORS.
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

from core import Core, OpenRouterLLM
from tools.compliance import ComplianceAssistant

from .fixtures import FIXTURE_ANSWER, FIXTURE_FINDINGS
from .serialize import finding_to_answer, issues_payload


def _origins() -> list[str]:
    # Vite binds 127.0.0.1 (see frontend/vite.config); allow both host spellings.
    default = "http://localhost:5173,http://127.0.0.1:5173"
    raw = os.getenv("GG_CORS_ORIGINS", default)
    return [o.strip() for o in raw.split(",") if o.strip()]


def _fixtures() -> bool:
    return os.getenv("GG_FIXTURES") == "1"


def create_app(*, core: Core | None = None, llm=None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        load_dotenv()  # loads .env; shell vars win (override=False)
        c = core or Core("assets")
        if not c.units.docs():                      # load once, in this event loop
            await c.load()
        app.state.assistant = ComplianceAssistant(c, llm or OpenRouterLLM())
        yield

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

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", port=int(os.getenv("PORT", "8010")), reload=True)
