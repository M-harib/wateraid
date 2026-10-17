# HANDOFF.md

## Last updated

2026-10-17 (America/Toronto)

## Last agent

Claude (this section); Codex before it (sections below, committed as `3430f2c`).

## Task

Connect the proposal review desk to the real backend, and add a Reporting Calendar date picker with sample data. Branch: `feat/water-theme` (pushed at `3430f2c`); the changes below are uncommitted.

## What changed (Claude)

- **Proposal review desk → real backend.** `frontend/src/api.ts` adds `loadProposal` (`GET /proposal`), `runProposalChecks` (`POST /proposal/run`) and `askProposal` (`POST /proposal/ask`), each Zod-validated, with timeouts sized for model calls (8 s / 300 s / 150 s) and the backend's `detail` message surfaced. For the demo project only, `DraftWorkspace` loads the cached proposal view, offers "Run proposal checks", lists call-checklist rows (Met / Not met / Unclear / Not addressed) that open their cited page, lists proposal issues with who decides, shows backend failures, and sends writing help to `/proposal/ask` (falls back to `/ask` when the proposal routes are absent). Local projects still never call the API.
- **Reporting Calendar.** `components/ReportingCalendar.tsx` + `calendar.css`: a month grid that works as the date picker, a jump-to-date input, "Next due after case date", and a detail panel per date with project tag, category, frequency, timing relative to the 30 June 2022 case date, period, verbatim due rule, required contents, reference forms, "Needs clarification" notes, and buttons that open the schedule and contents pages in file 03. Shown only when the backend returns no dated obligations; backend dates keep the existing list.
- **Sample data, isolated.** `frontend/src/calendarMock.ts` holds rules 4.5–4.10 from 03 Appendix D §3–4 and generates dates in the browser from them. Every item is tagged "Sample data", and the page states it is not a backend finding and does not show submission. This puts pack-derived dates in product code, which AGENTS.md normally forbids: delete the module (and its use in `ReportingCalendar`) once `GET /obligations` returns dated items. 4.5 (due with each advance request) is listed as "No fixed date" rather than placed on the calendar.

## Verification (Claude)

- `npm run build` passed after each change (TypeScript + Vite).
- Backend: `feat/proposal` run from a separate worktree (scratchpad), Python 3.14 venv with the pinned `pyproject.toml` deps; `pytest -q`: 155 passed. Server on `127.0.0.1:8010`: `/healthz` ok; `GET /proposal` returned empty views; `POST /proposal/ask` returned 503 because no model key was configured at the time.
- Playwright (Chrome) against `vite preview`: calendar defaults to 30 Sep 2022 (1 report); 14 Nov 2022 shows 4.6, 4.7, 4.8 with two clarification notes; jumping to 15 May 2022 shows 4.6 and 4.9 marked "Due date passed 46 days before 2022-06-30"; a source button opens the documents view; dark mode renders; 390 px mobile has 0 px horizontal overflow; no page errors.
- **Not yet verified:** a real cited issue and writing suggestion from the model, and the full demo rehearsal. A key now exists in the gitignored root `.env`; the next agent should restart the backend with it, run proposal checks, check one issue's quote against its page and one suggestion's citations, then rehearse.

## Open issues (Claude)

- Proposal routes exist only on unmerged `feat/proposal`; `main`'s backend lacks them.
- Clicking a proposal issue opens its page, but the evidence-workspace context panel looks up compliance findings only, so it shows no summary for proposal issues (`Dashboard.tsx`).

## What changed (Codex)

- Replaced the pastel/wave-card look with white and charcoal surfaces, a small blue accent, and a fine vector wave inspired by `design/dynamic-wave.avif`. Landing copy now leads with “Monitor your compliance with confidence.” Light/dark choice remains.
- Added `Project documents` as the demo project's opening view. New local projects open an independent intake. PDF, TXT, MD, DOCX, and XLSX originals are stored per project in browser IndexedDB; text is extracted from selectable PDF, TXT, and MD. Users can download/remove originals and move extracted text into the draft. DOCX/XLSX and scanned PDFs need an extraction/OCR service before they can become editable text.
- Added a six-page preliminary proposal template with the headings from the supplied proposal. The page outline scrolls to and focuses a page editor, and page handles/arrows reorder pages. The demo still supports one-click import of the supplied preliminary proposal PDF. Drafts autosave in this browser.
- The right review desk shows backend-provided requirements and issues when available. It calls the existing `POST /ask` endpoint for source-grounded writing feedback in the demo case. Cited feedback is split into individual items with `Add to doc` buttons, a selected-phrase action, and a drag handle. Insertions use the saved cursor/selection and retain source notes. New local projects have no demo analysis leakage.
- Added human draft approval, automatically cleared on subsequent edits. Print / save PDF uses the browser print dialog and exports selectable text. Scanned PDF OCR is not implemented; import reports the limitation.
- Existing Issues, Obligations, Evidence workspace, and finding review flows remain available in the sidebar.

## Verification (Codex)

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
