# HANDOFF.md

## Last updated

2026-10-17 (America/Toronto)

## Last agent

Claude (sections below to "What changed (Codex)"); Codex and the proposal workstream before it.

## Task

Combine `main` (teammate's backend + proposal review, through `f6b342c`) with the `feat/water-theme` frontend, keeping every water-theme frontend feature. **Not merged:** per the user, no `git merge` and no merge to `main` yet. `feat/water-theme` HEAD is `fae34dd` (no merge commit); the combined work is staged in the working tree. A full backup patch is in the Claude session scratchpad (`combined-water-theme-main.patch`, 347 KB).

## What changed (Claude)

- **Backend from `main`, unchanged:** `api/`, `core/`, `tools/`, `tests/`, `pyproject.toml`, `uv.lock`, `Makefile`, `.env.example`, `.python-version`, updated `docs/WORKSTREAMS.md`.
- **Teammate's frontend ported into the water-theme UI** (not the other way round):
  - "Proposal review" nav section (Q5/Q21/Q23 prompts, run card, question composer, priority findings, call checklist, GAC reviewer mapping). CSS rewritten with theme tokens and BRAND.md status colours; dark-mode values; mobile breakpoint fixed (their unconditional 3-column rule overrode mobile).
  - Their Ask link pointed to the removed `ask` page; it now opens the evidence-workspace assistant.
  - `PdfPreview` excerpt highlighting (from `main`) is now wired to findings, requirements, checklist evidence, reviewer rows, answer citations and evidence cards.
- **One proposal state:** `Dashboard` owns the proposal workspace and passes it to the Proposal draft review desk (no second fetch/run). Proposal findings now open with their context panel and "Record human review".
- **One proposal API client** in `api.ts`: `loadProposalWorkspace`, `runProposalChecks` (360 s), `askProposalQuestion` (150 s), surfacing backend `detail` messages. My earlier duplicate client was removed.
- **Schema tolerance** (`domain.ts`): checklist `evidence` defaults to `[]` and `absentSources` accepts strings or registry objects, so one odd row cannot reject the whole proposal view.
- **Fixes found in rehearsal:** duplicate React keys on evidence cards (backend evidence ids are `doc:page`, not unique); evidence cards now pass the excerpt for highlighting; resolver shown as "Who decides: GAC / Water Care staff" instead of raw `gac`.
- README and this file combine both sides; README routes corrected to `/projects/taps-for-rights/proposal`.

## Verification (Claude)

- No water-theme frontend file deleted vs `fae34dd`; every removed line is an in-place edit.
- `pytest -q` on the combined tree (Python 3.14 venv, pinned deps): **160 passed**.
- `npx tsc --noEmit` and `npm run build`: pass.
- Live backend with the `.env` key: `POST /proposal/ask` (Q5) returned a cited conflict (01 p.5 vs 03 p.2), quotes verified against page text. `POST /proposal/run` ×3: 66 s / 75 s / 31 s; 67/68 quotes matched page text (the miss is word-exact but joins two logic-model table rows with ";"). A cited writing suggestion for the cost-share page returned "answered" with a verified 02 p.1 quote.
- Playwright (Chrome) on a connected dev server: proposal review 16 checklist rows, findings, 9 reviewer rows, nav badge; cited issue opens with context, review button and 3 PDF highlights; draft from case proposal (6 pages) → cited feedback → Add to doc (source notes) → Approve; calendar; dark mode; 0 px mobile overflow on proposal, draft, overview; no console errors after the key fix.

## Merge into main (Claude)

- Merged `origin/main` (PR #5, an earlier water-theme + main integration; its resolution is a subset of ours, so ours kept plus its Ask-panel excerpt highlighting and highlight clearing on document switch) and `origin/feat/proposal` `10c80f8` (structured answers + background review progress).
- `10c80f8` changed the API contract: `POST /proposal/run` now returns 202 + run status; the frontend polls `GET /proposal/run/status`. Ported into the water-theme UI: progress bar with steps on the Proposal review card (also drives the draft desk's run button), structured `AnswerPanel` (direct answer, evidence confidence, supporting/conflicting evidence, missing information, next action). New CSS uses theme tokens.
- Verified: `pytest -q` 165 passed; `tsc` and `npm run build` pass; live run returned 202 and progressed to completed; Q5 answer shows medium confidence and conflicting evidence; Playwright: progress steps render, answer citation opens the PDF with highlights, 0 px mobile overflow, no console errors.
- New backend issue: `startup()` now runs all five steps concurrently; the checklist step then failed in 2 of 2 runs ("Response must be a finite JSON object"), versus 1 of 3 when sequential.

## Open issues (Claude)

- **Backend, for the proposal owner:** "Cost Share Vs Call" failed in all 3 full runs (`tools/proposal/evidence.py` `cited_percentage` rejects quotes with zero or several percentages); the checklist failed once with "Response must be a finite JSON object"; checklist row count varies (14 vs 16). Every `/proposal/ask` is stored as a proposal finding, so writing-help requests appear as "Generic Qa" priority findings.
- PDF highlight matching is loose (any text item of 5+ characters contained in the quote), so short phrases elsewhere can light up.
- `make up` uses `setsid`, which macOS lacks; the team README assumes `uv`. Without uv: `python3 -m venv .venv`, install the pinned deps, `.venv/bin/python -m uvicorn api.main:app --port 8010`.
- Ports 5173/5174 are taken by existing local Vite servers without `VITE_API_BASE_URL`; the backend's default CORS only allows 5173/5174 (`GG_CORS_ORIGINS` overrides).
- Calendar sample data (`calendarMock.ts`) still to be replaced by `GET /obligations` dates.

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

---

## Proposal workstream - 2026-10-17

Branch: `feat/proposal`

Built `tools/proposal/` as a checking-only view over the shared root-level core. It uses
the real `core.llm`, dispatch, checks, pipeline, verifier, unit store and finding store;
it does not import compliance or modify `core/schema.py`. The tool provides async
`ask()`, `checklist()`, `reviewer_questions()`, `issues()` and `startup()` views.

Implemented the proposal dispatch table, call/proposal checklist validation, code-side
cost-share and duration comparisons, a new generic `callmatch` construction oracle,
unsupported-claim grounding across files 02 and 04, PMF baseline/target checks, and
file 06 reviewer-question mapping. Known-absent forms abstain, example/formula budget
rows are excluded, quotations must verify, and exact quotes with a wrong model page ID
are relocated only when the match is unique. Cache keys include sources, prompts,
models, absent-source metadata, scenario date and question.

Added Q5/Q21/Q23 gold entries and pack-specific evaluator coverage under `tests/eval/`.
All ordinary unit inputs use made-up values; pack answers remain confined to eval.

Commands actually run:

- `git pull --ff-only origin main` - already up to date.
- `uv sync --locked` - installed the pinned Python 3.13 environment.
- `uv run pytest -q` - 102 passed after the final implementation.
- `uv run pytest -q tests/test_proposal.py tests/eval/test_proposal_pack.py` - 47 passed
  before the final candidate-hint adjustment; the later full run includes and passes them.
- `uv run --env-file .env python -m tests.eval.run_proposal` plus targeted `--ids`
  runs - Q5, Q21 and Q23 each passed live with their required verified citations;
  Q5 and Q21 also passed deterministic comparison checks. Provider availability was
  intermittent, so not every combined run passed all three together.
- `uv run --env-file .env python -m tools.proposal --view reviewer ...` - passed live:
  all 9 reviewer rows returned, 7 mapped and 2 explicitly not addressed, with verified
  citations and no operational failures.
- `uv run --env-file .env python -m tools.proposal --view quality ...` - passed live:
  18 code-side PMF checks and 2 qualitative issues, 4 verified evidence rows, no
  operational failures.
- Live checklist runs reached extraction but failed strict quote verification on one
  mandatory call quote (model-added ellipsis/duplicated word). The tool correctly
  returned zero checklist rows plus an explicit failure rather than accepting a
  non-verbatim funding-call rule.
- CLI known-absent smoke test passed for the Local Partners form.

Open integration/risk notes:

- W4 still owns HTTP routes and camelCase API serialization. Browser/dashboard testing
  is blocked until that layer mounts these functions; no browser provider was connected
  in this session.
- Checklist has deterministic/fixture coverage but still needs a successful live-model
  run with every mandatory call quotation verbatim. Reviewer mapping and PMF quality
  have successful live runs. `FakeLLM` pack tests validate the gate and citations, not
  model recall.
- The local OpenRouter key was moved from tracked `.env.example` into ignored `.env`
  without printing it. Never commit `.env`.
- Reviewer should inspect qualitative grounding precision, completeness of mandatory
  checklist rows, construction classifications, and the proposal/API mapping before merge.

### Proposal frontend integration - 2026-10-17

Rebased `feat/proposal` onto current `main` and merged the published `feat/api` branch,
then mounted the proposal assistant without changing `core/schema.py`. Added cached
proposal workspace, ask, run, checklist, and reviewer-mapping endpoints; the API boundary
maps proposal evidence and checklist rows to the frontend's camelCase Zod models.

Added `/dashboard/proposal` with Q5/Q21/Q23 shortcuts, an explicit full-run action,
priority findings, all nine checklist categories, reviewer-question mappings, operational
failure messages, and citation buttons into the existing source viewer. The local Vite
configuration points to port 8010; CORS accepts localhost and loopback Vite origins on
ports 5173 and 5174.

Commands actually run:

- `uv sync --locked` - installed the merged FastAPI dependencies.
- `uv run pytest -q tests/test_api.py tests/test_api_serialize.py tests/test_proposal.py tests/eval/test_proposal_pack.py` - 67 passed, with two upstream deprecation warnings.
- `uv run pytest -q` - 138 passed, with the same two upstream deprecation warnings.
- `npm run build` - TypeScript and Vite passed; the existing PDF chunk-size warning remains.
- Live `POST /proposal/ask` for Q5 returned `conflict` with five verified evidence entries across documents 03 and 01.
- `GET /healthz`, `GET /proposal`, known-absent `POST /proposal/ask`, and CORS from the Vite origin passed against the running services.
- Live `POST /proposal/run` returned 14 requirement rows across all nine categories;
  4 were met, 1 not met, 6 unclear, and 3 not addressed. The provider timed out
  on the three priority questions and reviewer mapping during the final combined run;
  those four named failures remained visible and retryable in the UI.
- Headless Microsoft Edge verified the connected proposal view at 1440 px and the
  responsive layout at 500 px. The browser showed the connected state, live checklist,
  source buttons, prompt cards, and named operational failures without horizontal overflow.

The built-in browser provider was unavailable, so the visual check used the installed
Edge headless executable. Live checklist reliability still depends on the model returning
every mandatory call quote verbatim; invalid quotations fail closed and appear in `failures`.

Follow-up after manual Q5 testing: OpenRouter returned HTTP 402. Proposal model failures
now preserve a safe cause (`provider_rejected` or `provider_rate_limited`), and
`POST /proposal/ask` returns HTTP 503 instead of wrapping the failure in a misleading
HTTP 200 `needs_review` answer. `uv run pytest -q tests/test_api.py tests/test_proposal.py`
passed 57 tests; a live Q5 request returned 503 with the credentials/credits guidance.

### Proposal provider/context follow-up - 2026-10-17

The backend reads the ignored repository-root `.env`. The configured OpenRouter key was
authenticated successfully. Added configurable per-tier output caps and deterministic,
per-document lexical page retrieval for the two focused comparisons. Every required
document remains represented and every returned quote still passes the shared verifier.
The whole-corpus unsupported-claims check remains exhaustive; it now sends bounded,
sequential page batches and requires the combined result to account for every unit.

Live `POST /proposal/ask` checks passed for Q5 and Q21. Q5 returned the 9.5% versus 10%
conflict with three source excerpts; Q21 returned a conflict with six call/proposal/report
excerpts. A fresh Q23 run could not complete because OpenRouter reported the account-level
credit pool exhausted (`total_usage` slightly exceeded `total_credits`), even though the
individual key remained valid. Provider failures continue to return HTTP 503 and remain
retryable after the account is funded.

Verification after these changes:

- `uv run pytest -q tests/test_proposal.py tests/eval/test_proposal_pack.py tests/test_llm.py tests/test_api.py` - 74 passed.
- `npm run build` - TypeScript and Vite passed; the existing PDF chunk-size warning remains.
- The repository `.env` was normalized to assignment-only UTF-8 so `uv --env-file .env`
  parses it without warnings; it remains ignored and was not added to Git.

### Proposal generic Q&A fallback - 2026-10-17

Added a `generic_qa` fallback so unrecognized proposal questions no longer route to the
unsupported-claims check. The fallback scans and ranks all permitted units from files
01–06 (or caller-selected document IDs), sends a bounded set of relevant units to the
model, verifies every returned quotation, and returns an explicit retrieved-page
abstention when the evidence cannot support an answer. Known Q5/Q21/Q23 and PMF-quality
intents retain their specialized deterministic paths.

`POST /proposal/ask` accepts optional camelCase `documentIds` for API callers, but the
proposal dashboard needs no source selection. Generic questions automatically search the
call (01), proposal (02), PMF (05), and reviewer-question rows (06). Specialized checks
can additionally use agreement/report sources 03 and 04. The UI directs reporting,
agreement, and broader pack questions to the separate Ask the documents workspace. No
`core/schema.py` shapes changed. Synthetic tests cover generic routing, optional-source
enforcement, verified answers and abstention.

Verification:

- `uv run pytest -q` - 155 passed with two upstream deprecation warnings.
- `npm run build` - TypeScript and Vite passed; the existing PDF chunk-size warning remains.
- Running API smoke check - `/healthz` passed, OpenAPI exposes `question,documentIds`, and
  an unsupported selected document returned HTTP 400.
- Live-model generic Q&A was not run because the configured OpenRouter account-level credit
  pool was exhausted. The browser-control provider was unavailable for a visual UI pass.

### Proposal question-agnostic chat - 2026-10-17

Decoupled the public proposal chat from the Q5/Q21/Q23 intent dispatcher. Every
`POST /proposal/ask` request now follows the same retrieval, model-answer and exact-quote
verification path over files 01–06. The three named questions remain dashboard examples
only. The structured `POST /proposal/run` review still runs the required cost-share,
construction and grounding checks independently of any question wording.

Cost-share answers can include a model-selected comparison of verified agreement and call
quotes. Code then parses those cited percentages and performs the arithmetic; no pack value
or conclusion is embedded in the product code. Retrieval eval coverage confirms that the
general chat context contains every required gold citation for Q5, Q21 and Q23. Pack-specific
expected citations remain under `tests/eval/` only.

Verification:

- `uv run pytest -q` - 160 passed with two upstream deprecation warnings.
- `npm run build` - TypeScript and Vite passed; the existing PDF chunk-size warning remains.
- Retrieval evals passed for Q5/Q21/Q23 plus varied location, duration, outcome and
  local-partner questions. General chat receives the complete six-page proposal and a
  bounded set of relevant supporting pages.
- Running `/healthz` and the proposal page returned HTTP 200. A 1440 px Edge headless
  render showed the connected proposal view, sample-question label and open-ended composer.

A fresh live-model answer-quality run still requires restoring the exhausted OpenRouter
account balance.

### Structured answers and asynchronous proposal review - 2026-10-17

Expanded the API answer view without changing `core/schema.py`. Both document and proposal
answers now expose a direct answer, evidence-confidence level and reason, separate supporting
and conflicting evidence, missing information, and a suggested next action. The dashboard
renders the recommendation in its own labelled block so it cannot be mistaken for a document
fact. Existing `answer`, `status`, and `evidence` fields remain for compatibility.

Changed the full proposal review into a tracked background job. `POST /proposal/run` returns
HTTP 202 immediately, and `GET /proposal/run/status` reports five step states plus completed
count and percentage. The three focused checks, checklist, and reviewer mapping run
concurrently within the shared model semaphore. Duplicate start requests reuse the active
run, the dashboard polls every 800 ms, partial stored views remain readable, and lifespan
shutdown cancels an unfinished task cleanly.

Verification:

- `uv run pytest -q` - 165 passed with two upstream deprecation warnings.
- `npm run build` - TypeScript and Vite passed; the existing PDF chunk-size warning remains.
- A live background start returned in 114 ms and visibly advanced 0%, 20%, 40%, 60%, 80%,
  then 100% over about 71 seconds. The dashboard stayed usable during the run.
- The live run returned nine reviewer mappings and surfaced two invalid model extractions as
  named retryable failures; it did not silently accept them.
- A live open-ended partner question returned an accurate direct answer with high evidence
  confidence and two verified proposal citations, with conflicts, gaps, and the recommendation
  serialized separately.
- A 1440 px Edge headless render verified the in-progress step list, progress bar, partial
  findings, composer, and responsive card layout.
