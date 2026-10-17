# HANDOFF.md

## Last updated

2026-10-17 (America/Toronto)

## Last agent

Codex

## Task

Redesign the frontend around the working build plan: a focused landing page, separate dashboard views, and original documents in the main evidence canvas. Branch: `feat/landing-dashboard-workspace`.

## What changed

- Replaced the all-in-one dashboard with a Rezzy-inspired landing page at `/` and a white workspace at `/dashboard`.
- Split the workspace into Overview, Ask, Issues, Obligations, Reporting calendar, Source library, and Review history. The PDF is now the central canvas in Source library, with citation cards above it and a compact file list to the left.
- Kept source-pack preview honest: seven original files and guide questions 8, 11, and 24 are available, but no generated answers or findings are seeded.
- Added a provisional `POST /ask` adapter. `GET /findings` and `GET /obligations` still feed the Issues and Obligations views; Calendar is projected from cited obligation dates until the canonical calendar route exists. All responses are validated before display.
- Preserved browser-local human review, including a stale indicator when a finding or its evidence changes. Removed the unused right-panel evidence component.
- Updated `AGENTS.md`, architecture, decisions, and frontend README to treat `docs/Taps_for_Rights_Build_Plan.pdf` as the working plan. The original source pack remains authoritative for grant facts.

## Verification

- `npm run build` passed (TypeScript and Vite). Vite still warns that the on-demand PDF chunk exceeds 500 kB.
- Headless Chrome checked landing → workspace → source library → Q&A on desktop, and landing → workspace and the source canvas on a 390 px viewport. The PDF rendered in the center; mobile zoom increased its width within a horizontally scrollable viewer without page overflow or page errors.
- A browser smoke test with temporary mocked `GET /findings`, `GET /obligations`, and `POST /ask` verified a two-source finding with a new kind and resolver, PDF navigation, a clarification review saved to history, and an answer citation opening the source canvas. These fixtures live outside product code.
- Final `npm run build` and `git diff --check` passed.

## Integration notes and limits

The build plan names `core/schema.py` as the canonical backend/frontend contract; `docs/WORKSTREAMS.md` places it at `backend/core/schema.py` and assigns W1 ownership. The frontend's Zod types and Q&A response are provisional. The dashboard now accepts new `Finding.kind` strings and displays an optional `resolver`, resolving two of the frontend contract points in `docs/WORKSTREAMS.md`. Map the canonical FastAPI output into these view models or generate types from OpenAPI; do not force the backend to match a temporary frontend shape. No backend is connected in the default preview. Q&A requires `POST /ask`; source quote verification belongs to the backend. The review log is local to one browser. PDF citations open a page and display an excerpt above it; exact in-page highlighting remains pending.

The teammate-provided build-plan PDF, `docs/WORKSTREAMS.md`, and the concurrent edit to `docs/CURRENT_TASK.md` were published in a separate documentation commit without changing their content. The reference screenshots `design/design-3.png` and `design/design-4.png` remain untracked and are not required by the app.

## Review findings

None recorded yet.

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
