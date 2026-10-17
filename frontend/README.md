# GrantGuard frontend

GrantGuard has a Rezzy-inspired landing page and a lean, white-theme React/Vite dashboard for the A6 prototype. It uses the local source pack in `../assets/` and does not generate grant findings on its own.

## Run

```bash
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. `/` is the landing page; `/dashboard` opens the workspace. `npm run build` runs TypeScript and creates a production bundle. Hosts serving the production bundle must fall back to `index.html` for `/dashboard/*` paths.

## Current behavior

- The landing page leads into separate Overview, Ask, Issues, Obligations, Calendar, Source library, and Review history views. The PDF viewer occupies the main source canvas; citation cards sit above it.
- Without an API URL, the dashboard shows the seven real pack files and three **investigation prompts** from guide questions 8, 11, and 24. It labels them as prompts, never as findings or answers.
- Click a prompt, issue, or obligation to inspect the cited PDF page in the central source canvas. The viewer supports page navigation and zoom; spreadsheets open as original workbooks.
- With backend responses, the Issues and Obligations views show validated records. Staff can confirm, correct, dismiss, escalate, or request clarification on findings. Review records are append-only in this browser's `localStorage`, keyed to the finding and its evidence; changes mark earlier reviews stale.
- This frontend does not verify source quotations itself. The backend must perform quote verification before setting `verified: true`.

## Backend connection

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the FastAPI origin. The frontend requests the build plan's `GET /findings`, `GET /obligations`, and `POST /ask` routes. Calendar entries are derived from the due dates on cited obligations; `GET /calendar` can replace that projection when its canonical response is ready. Configure CORS for the Vite origin during local development. The frontend currently accepts an array or a `{ "findings": [...] }` wrapper for findings, and an array or `{ "obligations": [...] }` for obligations. A compatible finding view model is:

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

The review log is local to one browser and is not shared with teammates. The PDF view opens the cited page and displays the quoted excerpt above it; it does not yet paint a highlight over the exact words on the page. Q&A needs a connected backend; no answers are preloaded. There is no upload, authentication, or compliance certification in this frontend.
