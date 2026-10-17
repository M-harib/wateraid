# HANDOFF.md

## Last updated

2026-10-17 (America/Toronto)

## Last agent

Codex

## Task

Combine Ask the documents with the source viewer and add a project-level entry point for the frontend. Branch: `feat/unified-evidence-projects`.

## What changed

- Added `/projects` as a project hub. Taps for Rights remains the only demo project with bundled sources and backend calls. The canonical demo route is `/projects/taps-for-rights`; `/dashboard/*` still works as a legacy alias.
- Added browser-local project shells with a name, optional organization, stable UUID, and empty setup page. These shells never display the Taps for Rights documents, findings, Q&A, or reviews. They can be removed from the browser after confirmation. No account, upload, or shared storage is claimed.
- Replaced the standalone Ask page and Source Library navigation item with one Evidence workspace. The source PDF remains central. A right-side Ask panel opens on demand, uses the existing validated `POST /ask` adapter, and links each answer citation to the cited document and page. On smaller screens it opens as a sheet and closes when a citation is selected.
- Added a desktop sidebar toggle. The collapsed menu keeps its icons, accessible labels, and project switch; the preference is saved in browser storage. The mobile drawer remains expanded.
- Kept original documents read-only. Existing finding review and correction records remain separate from generated findings.
- Updated frontend README and architecture notes to describe the project and API boundaries.

## Verification

- `npm run build` passed, including TypeScript. Vite reported its existing on-demand PDF chunk size warning.
- Headless Chrome checked landing → project hub → new local shell → demo project → evidence workspace, document selection, assistant opening, and the mobile sheet. No page errors or mobile page overflow were reported.
- Chrome also checked that a project shell survives reload, can be removed, and that the desktop sidebar collapses, stays collapsed after reload, and expands again.
- With temporary mocked `GET /findings`, `GET /obligations`, and `POST /ask` responses outside product code, Chrome verified that an answer citation opened the cited Year 3 report at page 2. This verifies frontend routing and rendering, not the backend's answer quality.
- Final `git diff --check` passed. A separate browser check confirmed that the brand mark remains visible in the collapsed sidebar.

## Integration notes and limits

The current API has no project ID. Only the Taps for Rights demo invokes it. Before enabling analysis for other projects, the backend must assign project ownership, scope all documents/findings/answers/reviews to that ID, and enforce account access server-side. The browser-local shells are organization scaffolding only; their metadata is not synchronized. The demo review log is also browser-local. The original PDFs open a cited page and show excerpts, but do not highlight exact words in the page canvas.

The frontend's Zod types and `POST /ask` shape remain provisional. `backend/core/schema.py` is the team-owned canonical contract; coordinate any integration mapping with W1. The untracked `design/design-3.png` and `design/design-4.png` are teammate reference assets and were not changed.

## Review findings

None recorded yet. Review the project boundary, mobile assistant behavior, and eventual backend project scoping before extending the multi-project flow.
