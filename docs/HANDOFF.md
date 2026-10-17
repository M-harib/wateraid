# HANDOFF.md

## Last updated

2026-10-17 (America/Toronto)

## Last agent

Codex

## Task

Prepare a focused project-manager demo flow with a dedicated document intake and proposal template. Branch: `feat/water-theme`, based on `feat/unified-evidence-projects` (`84ed2b2`). Work is uncommitted.

## What changed

- Replaced the pastel/wave-card look with white and charcoal surfaces, a small blue accent, and a fine vector wave inspired by `design/dynamic-wave.avif`. Landing copy now leads with “Monitor your compliance with confidence.” Light/dark choice remains.
- Added `Project documents` as the demo project's opening view. New local projects open an independent intake. PDF, TXT, MD, DOCX, and XLSX originals are stored per project in browser IndexedDB; text is extracted from selectable PDF, TXT, and MD. Users can download/remove originals and move extracted text into the draft. DOCX/XLSX and scanned PDFs need an extraction/OCR service before they can become editable text.
- Added a six-page preliminary proposal template with the headings from the supplied proposal. The page outline scrolls to and focuses a page editor, and page handles/arrows reorder pages. The demo still supports one-click import of the supplied preliminary proposal PDF. Drafts autosave in this browser.
- The right review desk shows backend-provided requirements and issues when available. It calls the existing `POST /ask` endpoint for source-grounded writing feedback in the demo case. Cited feedback is split into individual items with `Add to doc` buttons, a selected-phrase action, and a drag handle. Insertions use the saved cursor/selection and retain source notes. New local projects have no demo analysis leakage.
- Added human draft approval, automatically cleared on subsequent edits. Print / save PDF uses the browser print dialog and exports selectable text. Scanned PDF OCR is not implemented; import reports the limitation.
- Existing Issues, Obligations, Evidence workspace, and finding review flows remain available in the sidebar.

## Verification

- `npm run build` passed after the editor integration; TypeScript passed. PDF import loads dynamically, keeping the initial app chunk below Vite's 500 kB warning threshold.
- Headless Chrome checked the landing light/dark toggle, persistence, project navigation, and mobile overflow. The earlier editor smoke check passed for routing, editing, approval/reset, TXT intake, section reorder, and print-to-PDF generation. A new intake/template smoke check passed for new-project routing, TXT upload persistence, moving text into a draft, six template pages, page focus, reorder, and mobile overflow; no page errors.
- Headless Chrome imported the supplied proposal PDF into six editable page sections and confirmed extracted text on the first page.
- A separate project test passed setup, project-specific intake, persistence, and isolation from the demo's unscoped analysis API.
- A mocked connected API test passed requirements and issues in the review desk, a cited suggestion, insertion with a saved source note, and navigation to the original cited document. The real backend was not connected in this check.
- Chromium generated a three-page PDF from the edited draft; PDF.js read the exported text successfully.
- `git diff --check` passed after the final docs update.

## Integration notes and limits

`frontend/src/api.ts` still uses the provisional `GET /findings`, `GET /obligations`, and `POST /ask` contract for the Taps for Rights demo only. W1 owns `backend/core/schema.py`; coordinate any API change. The writing-help prompt passes draft context to `/ask`, but that endpoint was designed for Q&A, so review actual backend behavior before making it a judged demo step. No project-scoped upload or analysis API exists yet. The backend needs a project-scoped document upload/ingestion route, document IDs and processing status, and project-scoped findings/obligations before these uploads can participate in AI analysis. Browser-local originals/drafts are suitable for a live single-browser demo and are not shared across devices. PDF text extraction preserves text, not original layout; scanned PDFs require an OCR service.

The untracked `design/design-3.png`, `design/design-4.png`, and `design/dynamic-wave.avif` are user references. They were not modified or added to the app bundle. The uncommitted theme files are part of this branch and should be preserved.

## Suggested next step

Connect a project-scoped upload/analysis flow with the backend team, then inspect one cited finding and one writing suggestion in the right desk. Rehearse: project → upload documents → choose template → edit/reorder → inspect issue → insert suggestion → approve → print/save PDF. Keep source claims tied to the original pack and do not seed fabricated findings.
