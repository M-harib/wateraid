# GrantGuard frontend

GrantGuard has a landing page, a project hub, and a React/Vite evidence workspace for the A6 prototype. Its restrained editorial visual system has light and dark modes. It uses the local source pack in `../assets/` and does not generate grant findings on its own.

## Run

```bash
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. `/` is the landing page; `/projects` lists projects; `/projects/taps-for-rights` opens the demo case. `/dashboard/*` remains a legacy alias. `npm run build` runs TypeScript and creates a production bundle. Hosts serving the production bundle must fall back to `index.html` for `/projects/*` and `/dashboard/*` paths.

For the connected proposal demo, start the API from the repository root in another terminal:

```bash
uv run --env-file .env python -m api.main
```

Copy `frontend/.env.example` to `frontend/.env.local` before starting Vite. Open
`/projects/taps-for-rights/proposal`, choose Q5, Q21, or Q23, or run the full proposal review.

## Current behavior

- The project hub lists the Taps for Rights demo and allows separate browser-local projects with a name and optional organization. Every project has its own editable proposal and intake list. New projects do not inherit demo findings or source analysis. Remove a project from its detail page. Account sign-in, cross-device sync, and analysis of new projects are not implemented.
- The demo project opens in Project documents and also has Proposal draft, Proposal review, Overview, Issues, Obligations, Calendar, Evidence workspace, and Review history views. In the evidence workspace, the PDF occupies the main canvas; the optional Ask the documents panel sits to its right on desktop and opens as a sheet on smaller screens. The document selector stays available when the assistant is open.
- The desktop left menu can collapse to labeled icon buttons. Its layout choice is remembered in this browser; the mobile drawer keeps full labels.
- Light mode is the default. The theme switch appears on the landing page, project hub, and dashboard, and saves the choice in this browser. A fine-line wave marks the hero; the workspace uses plain reading surfaces.
- Project documents accepts PDF, TXT, Markdown, DOCX, and XLSX files by picker or drop zone, stores each original in browser IndexedDB, and extracts text from selectable PDFs, TXT, and Markdown. Files can be downloaded or removed. DOCX and XLSX are stored without extraction, and scanned PDFs need OCR. Uploaded files are **not included in AI analysis** until a project-scoped backend upload route is connected.
- In the proposal editor, select the supplied preliminary-proposal outline or start blank. The outline has six pages with the requested headings. Click an outline page to scroll to and focus its editor; drag page handles or use the arrows to reorder. Text PDFs, TXT, and Markdown can also be imported into editable pages. Edits save per project in this browser. The demo can load the preliminary proposal from the source pack with one click. A connected demo analysis service can provide cited requirements, issues, and page-specific writing feedback on the right. The user can add individual feedback items or a selected phrase at the saved cursor position, or drag an item onto a page; source notes remain visible. Human approval clears on edits. The browser print dialog prints or saves a selectable-text PDF; this is not OCR.
- Proposal review calls the dedicated proposal API (`GET /proposal`, `POST /proposal/run`, `POST /proposal/ask`), displays the Q5/Q21/Q23 findings, the call checklist, and GAC-reviewer mappings, and opens every citation in the evidence workspace with the cited excerpt highlighted on the PDF page. The Proposal draft review desk shows the same results (one shared state) and sends page-level writing help to `POST /proposal/ask`.
- Without dated obligations from the backend, the Reporting calendar shows a month date picker over **sample data** generated from the agreement's reporting schedule (`src/calendarMock.ts`). Every item is tagged "Sample data"; delete that module once `GET /obligations` returns dated items.
- Without an API URL, the dashboard shows the seven real pack files and three **investigation prompts** from guide questions 8, 11, and 24. It labels them as prompts, never as findings or answers.
- Click a prompt, issue, obligation, or answer citation to inspect the cited PDF page in the central source canvas. The viewer supports page navigation and zoom; spreadsheets open as original workbooks. Original documents are read-only; corrections and decisions are recorded separately on findings.
- With backend responses, the Issues and Obligations views show validated records. Staff can confirm, correct, dismiss, escalate, or request clarification on findings. Review records are append-only in this browser's `localStorage`, keyed to the finding and its evidence; changes mark earlier reviews stale.
- This frontend does not verify source quotations itself. The backend must perform quote verification before setting `verified: true`.

## Backend connection

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the FastAPI origin (default `http://localhost:8010`). Only the Taps for Rights demo calls the build plan's `GET /findings`, `GET /obligations`, and `POST /ask` routes and the proposal routes `GET /proposal`, `POST /proposal/ask`, and `POST /proposal/run`. These routes have no project parameter yet, so do not reuse them for new project shells. Calendar entries are derived from the due dates on cited obligations; `GET /calendar` can replace that projection when its canonical response is ready. Configure CORS for the Vite origin during local development. The frontend currently accepts an array or a `{ "findings": [...] }` wrapper for findings, and an array or `{ "obligations": [...] }` for obligations. A compatible finding view model is:

```json
{
  "findings": [
    {
      "id": "<stable-finding-id>",
      "kind": "deadline_conflict",
      "title": "<short review question>",
      "summary": "<qualified explanation>",
      "priority": "medium",
      "state": "needs_review",
      "nextAction": "<human next step>",
      "owner": null,
      "dueOn": null,
      "evidence": [
        {
          "id": "<stable-evidence-id>",
          "documentId": "03",
          "version": "<declared version or unknown>",
          "locator": { "page": 1, "section": "<section if known>" },
          "excerpt": "<verbatim source text>",
          "verified": true
        },
        {
          "id": "<second-stable-evidence-id>",
          "documentId": "04",
          "version": "<declared version or unknown>",
          "locator": { "page": 1 },
          "excerpt": "<second verbatim source text>",
          "verified": true
        }
      ]
    }
  ]
}
```

The example is a **shape**, not an answer or seeded finding. `kind` accepts new named types from the shared pipeline. A finding may include `resolver`, which the evidence view displays for staff review. Each obligation view model needs an ID, title, category, statement, status (`unreviewed`, `needs_clarification`, or `reviewed`), optional `dueOn`, and at least one evidence item. A `deadline_conflict` needs at least two evidence items. Every evidence item must identify one of the bundled files `00`–`06` and needs a page, section, or sheet plus cell range. A verified evidence item needs an excerpt. The frontend rejects an invalid findings response and clearly falls back to source-pack preview. If `/obligations` is unavailable, findings still load and the register stays empty.

For Q&A, the provisional `POST /ask` request is `{ "question": "..." }` and the response is `{ "answer": "...", "status": "answered|conflict|not_found|needs_review", "evidence": [...] }`. Each Q&A evidence item needs `documentId`, `locator`, and optional `excerpt`. An `answered` response needs at least one source; a `conflict` needs both sides. The backend may choose a different canonical shape. This frontend's Zod schemas are **provisional view models**, not a replacement for `backend/core/schema.py` in the working plan and `docs/WORKSTREAMS.md`. Once that schema and FastAPI's OpenAPI output exist, adapt `src/api.ts` and generate shared types rather than forcing the backend to copy this provisional shape. Coordinate field changes with the dashboard owner.

## Limits

Project shells and the demo review log are local to one browser and are not shared with teammates. The PDF view opens the cited page and displays the quoted excerpt above it; it does not yet paint a highlight over the exact words on the page. Q&A needs a connected backend; no answers are preloaded. There is no backend upload, OCR, authentication, or compliance certification in this frontend.
