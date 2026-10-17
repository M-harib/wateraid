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
