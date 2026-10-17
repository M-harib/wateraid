# GrantGuard frontend

White-theme React/Vite dashboard for the A6 compliance prototype. It uses the local source pack in `../assets/` and does not generate grant findings on its own.

## Run

```bash
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` runs TypeScript and creates a production bundle. The frontend is separate from the planned Python service.

## Current behavior

- Without an API URL, the dashboard shows the seven real pack files and three **investigation prompts** from guide questions 8, 11, and 24. It labels them as prompts, never as findings.
- Click a prompt or document to inspect the original PDF in the evidence desk. PDF page navigation is built in; spreadsheets open as original workbooks.
- With a backend response, the requirements register shows cited obligations and the action queue shows validated findings. Staff can confirm, correct, dismiss, escalate, or request clarification on findings. Review records are append-only in this browser's `localStorage`, keyed to the finding and its evidence; changes mark earlier reviews stale.
- This frontend does not verify source quotations itself. The backend must perform quote verification before setting `verified: true`.

## Backend connection

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the FastAPI origin. The frontend requests the build plan's `GET /findings` and `GET /obligations` routes. Configure CORS for the Vite origin during local development. The frontend currently accepts an array or a `{ "findings": [...] }` wrapper for findings, and an array or `{ "obligations": [...] }` for obligations. A compatible finding view model is:

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

The example is a **shape**, not an answer or seeded finding. Each obligation view model needs an ID, title, category, statement, status (`unreviewed`, `needs_clarification`, or `reviewed`), optional `dueOn`, and at least one evidence item. A `deadline_conflict` needs at least two evidence items. Every evidence item must identify one of the bundled files `00`–`06` and needs a page, section, or sheet plus cell range. A verified evidence item needs an excerpt. The frontend rejects an invalid findings response and clearly falls back to source-pack preview. If `/obligations` is unavailable, findings still load and the register stays empty.

The newly added `docs/Taps_for_Rights_Build_Plan.pdf` names `core/schema.py` as the canonical schema and also plans `GET /calendar`, `POST /ask`, and other routes. This frontend's Zod schemas are **provisional view models**, not a replacement for that canonical schema. Once `core/schema.py` and FastAPI's OpenAPI output exist, adapt `src/api.ts` and generate shared types rather than forcing the backend to copy this provisional shape. Coordinate field changes with the dashboard owner.

## Limits

The review log is local to one browser and is not shared with teammates. The PDF view opens the cited page and displays the quoted excerpt beside it; it does not yet paint a highlight over the exact words on the page. There is no upload, live Q&A, authentication, or compliance certification in this frontend.
