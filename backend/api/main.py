"""FastAPI app exposing the dashboard endpoints, with CORS.
The web framework lives only here; core stays framework-agnostic.

Run: uv run python -m api.main   (serves on http://localhost:8010; set PORT to override)
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from urllib.error import HTTPError

from dotenv import load_dotenv
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from core import Core, OpenRouterLLM
from core.workspace import Workspace
from tools.compliance import ComplianceAssistant
from tools.proposal import ProposalAssistant
from tools.proposal.writing import WritingAssistant, WritingUnavailable
from tools.workspace import WorkspaceAssistant

_MEDIA = {
    "pdf": "application/pdf",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
}

from .fixtures import FIXTURE_ANSWER, FIXTURE_FINDINGS
from .proposal_run import ProposalRunTracker
from .serialize import (
    checklist_rows_to_view,
    finding_to_answer,
    issues_payload,
    proposal_payload,
    reviewer_rows_to_view,
    writing_help_to_view,
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


def _provider_error(exc: Exception) -> str:
    """A safe, actionable message for a failed model call; never the provider's body or credentials.
    OpenRouterLLM wraps HTTP errors in RuntimeError, so look at the cause too."""
    http = exc if isinstance(exc, HTTPError) else exc.__cause__ if isinstance(exc.__cause__, HTTPError) else None
    if http is not None and http.code in {401, 402, 403}:
        return "Analysis provider rejected the request. Check server-side model credentials or credits."
    if http is not None and http.code == 429:
        return "Analysis provider is temporarily rate limited. Try again shortly."
    if isinstance(exc, RuntimeError) and "API_KEY not set" in str(exc):
        return "No model API key is configured on the server."
    return "Analysis service unavailable or timed out."


class WritingHelpRequest(BaseModel):
    heading: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=20_000)
    question: str = Field(max_length=2_000)


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
        app.state.model = model
        app.state.assistant = ComplianceAssistant(c, model)
        app.state.proposal = ProposalAssistant(c, model)
        app.state.writing = WritingAssistant(app.state.proposal)
        app.state.proposal_run = ProposalRunTracker()
        app.state.workspace = Workspace()
        await app.state.workspace.load_all()  # re-ingest persisted uploads
        try:
            yield
        finally:
            await app.state.proposal_run.close()

    app = FastAPI(title="Grant Compliance API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=_origins(),
        allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["*"],
        # pdf.js uses range requests; cross-origin it must read these to size/stream the PDF
        expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
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

    @app.post("/proposal/writing-help")
    async def proposal_writing_help(request: Request, body: WritingHelpRequest):
        """Cited tips and editable draft sentences for one proposal page; not stored as a finding."""
        if not body.question.strip():
            return JSONResponse({"detail": "question is required"}, status_code=400)
        try:
            result = await request.app.state.writing.help(body.heading, body.body, body.question)
        except WritingUnavailable as exc:
            return JSONResponse({"detail": str(exc)}, status_code=503)
        except (HTTPError, OSError, RuntimeError, TimeoutError) as exc:
            return JSONResponse({"detail": _provider_error(exc)}, status_code=503)
        return writing_help_to_view(result)

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

    # --- projects ---

    @app.get("/projects")
    async def list_projects(request: Request):
        return {"projects": request.app.state.workspace.list_projects()}

    @app.post("/projects", status_code=201)
    async def create_project(request: Request):
        body = await request.json()
        name = (body or {}).get("name", "").strip()
        if not name:
            return JSONResponse({"detail": "name is required"}, status_code=400)
        corpus = await request.app.state.workspace.create(name)
        return {"projectId": corpus.project_id, "name": corpus.name}

    @app.patch("/projects/{project_id}")
    async def rename_project(project_id: str, request: Request):
        """Change a project's display name. The id (URL, uploads, saved drafts) stays the same."""
        body = await request.json()
        name = " ".join(str((body or {}).get("name", "")).split())
        if not name:
            return JSONResponse({"detail": "name is required"}, status_code=400)
        if len(name) > 120:
            return JSONResponse({"detail": "name must be 120 characters or fewer"}, status_code=400)
        corpus = await request.app.state.workspace.project(project_id)
        await corpus.set_name(name)
        return {"projectId": corpus.project_id, "name": corpus.name,
                "documentCount": len(corpus.docs), "ready": corpus.ready()}

    @app.delete("/projects/{project_id}")
    async def delete_project(project_id: str, request: Request):
        """Delete a project with its uploaded files. Bundled pack files are not affected."""
        if not await request.app.state.workspace.delete(project_id):
            return JSONResponse({"detail": "project not found"}, status_code=404)
        return {"deleted": project_id, "projects": request.app.state.workspace.list_projects()}

    # --- per-project uploaded documents (PDF / Excel / CSV) ---

    @app.post("/projects/{project_id}/documents", status_code=202)
    async def upload_documents(project_id: str, request: Request, files: list[UploadFile] = File(...)):
        """Accept files, schedule background ingestion, return the tracker immediately."""
        corpus = await request.app.state.workspace.project(project_id)
        accepted, rejected = [], []
        for upload in files:
            data = await upload.read()
            try:
                meta = await corpus.add_file(upload.filename or "upload", data)
            except ValueError as exc:
                rejected.append({"filename": upload.filename, "detail": str(exc)})
                continue
            corpus.schedule_ingest(meta.doc_id)
            accepted.append(meta.to_dict())
        return {"projectId": corpus.project_id, "accepted": accepted, "rejected": rejected,
                "documents": corpus.documents(), "ready": corpus.ready()}

    @app.get("/projects/{project_id}/documents")
    async def list_documents(project_id: str, request: Request):
        """Ingestion tracker: per-document status + whether the project is ready to query."""
        corpus = await request.app.state.workspace.project(project_id)
        return {"projectId": corpus.project_id, "documents": corpus.documents(), "ready": corpus.ready()}

    @app.get("/projects/{project_id}/documents/{doc_id}/file")
    async def get_document_file(project_id: str, doc_id: str, request: Request):
        corpus = await request.app.state.workspace.project(project_id)
        path = corpus.path_for(doc_id)
        if not path or not path.exists():
            return JSONResponse({"detail": "document not found"}, status_code=404)
        meta = corpus.docs[doc_id]
        return FileResponse(str(path), media_type=_MEDIA.get(meta.kind, "application/octet-stream"),
                            filename=meta.filename)

    @app.delete("/projects/{project_id}/documents/{doc_id}")
    async def delete_document(project_id: str, doc_id: str, request: Request):
        corpus = await request.app.state.workspace.project(project_id)
        if not await corpus.remove(doc_id):
            return JSONResponse({"detail": "document not found"}, status_code=404)
        return {"deleted": doc_id, "documents": corpus.documents()}

    @app.post("/projects/{project_id}/ask")
    async def project_ask(project_id: str, request: Request):
        body = await request.json()
        question = (body or {}).get("question", "").strip()
        if not question:
            return JSONResponse({"detail": "question is required"}, status_code=400)
        corpus = await request.app.state.workspace.project(project_id)
        if not any(m.status == "ready" for m in corpus.docs.values()):
            return JSONResponse({"detail": "no documents are ready yet; upload and wait for ingestion"},
                                status_code=409)
        try:
            finding = await WorkspaceAssistant(corpus, request.app.state.model).ask(question)
        except RuntimeError as exc:  # e.g. OPENROUTER_API_KEY not set
            return JSONResponse({"detail": str(exc)}, status_code=503)
        return finding_to_answer(finding, allowed_docs=None)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", port=int(os.getenv("PORT", "8010")), reload=True)
