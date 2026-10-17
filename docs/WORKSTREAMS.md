# WORKSTREAMS.md

How the team builds the backend in parallel with the dashboard. This file says who owns which files, what to build first, and the contract between backend and frontend. The shared milestone is in `docs/CURRENT_TASK.md`; the design reference (dispatch map, coverage map, checks) is in `docs/Taps_for_Rights_Build_Plan.pdf`.

**Status (2026-10-17).** The shared core is built and on `main`, at the repo **root** (not `backend/`): async ingest, registry, finding store, quote verifier, rules dispatch, deterministic checks, the validate/escalate gate, a tiered LLM client (OpenRouter + a `FakeLLM` for offline dev), and the eval scorer. 54 pytest tests pass (`uv run pytest -q`). Still to build: extraction (W2), the per-tool finding drafters + FastAPI layer (W4), and the `tools/compliance` + `tools/proposal` views.

## Ground rules for every workstream

- Branch per workstream (`feat/w2-extract`, `feat/w4-api`, …); open small PRs into `main`. Only touch the files your workstream owns; ask the owner before editing someone else's.
- `core/schema.py` is the contract. W1 owns it; any field change goes through a PR the dashboard owner reviews. Changes are additive: add optional fields, do not rename or remove.
- No pack answers in product code (`core/`, `tools/`, `frontend/`). Expected answers live only in `tests/eval/`. Unit tests use generic inputs, not the pack's figures.
- The model never computes dates, sums, percentages or thresholds. Code does (`core/checks/`); the model narrates code results and quotes sources.
- The scenario date is a parameter (`AS_OF = 2022-06-30`), never the system clock.
- Secrets (OpenRouter key) stay in `.env`, which is gitignored (`.env.example` is tracked). The frontend never calls a model.
- After substantial work, append to your workstream's section in `docs/HANDOFF.md`: what changed, commands you actually ran and their results, open risks.

## Layout (as committed)

```text
pyproject.toml          # uv, Python 3.13; deps pinned + security-validated
core/                   # the funder-agnostic engine, shared by both tools
  schema.py             # [done] W1 – the contract (stdlib dataclasses, to_dict())
  registry.py           # [done] W1 – pack files 00–06, declared versions, known-absent + reference-only
  ingest/               # [done] W1 – async PDF page units + workbook cell units (pypdf, openpyxl)
  store.py              # [done] W1 – async UnitStore + FindingStore
  verify.py             # [done] W1 – quote verifier
  format.py             # [done] locator_label() for FE citations
  dispatch.py           # [done] W4 – Intent + route() (intent -> docs -> checks -> tier)
  checks/               # [done] W3 – deterministic oracles + score_urgency
  pipeline.py           # [done] W4 – validate() + run() escalate gate
  llm.py                # [done] W2 – tiered OpenRouter client + FakeLLM
  extract/              # [todo] W2 – obligations ledger, report indicators, call checklist
  findings.py           # [todo] W4 – draft, conflict grouping, resolver, urgency "why"
tools/
  compliance/           # [todo] config + obligations/calendar/issues views
  proposal/             # [todo] config + call-requirements checklist
api/                    # [todo] W4 – FastAPI routes, CORS for the Vite origin, static assets/
tests/                  # [done] 54 tests (pytest + pytest-asyncio)
  eval/                 # [partial] W5 – scorer.py done; gold.json hand-authored, mostly todo
assets/                 # the 7 pack files (+ ESDC reference forms, excluded from the corpus)
frontend/               # dashboard owner
```

The build plan shows `core/` under `backend/`; as committed it sits at the repo root alongside `frontend/`. Keep it at root unless the team decides to nest a `backend/`. The stack also differs from the original plan: **Python 3.13** (uv), **pypdf** (not PyMuPDF), **stdlib dataclasses + `to_dict()`** (not Pydantic), **`tests/eval/gold.json`** (not `eval/gold.yaml`).

## Contract (backend ↔ frontend)

`core/schema.py` defines the backend shapes as **snake_case dataclasses**; `to_dict()` emits JSON. The frontend (`frontend/src/domain.ts`) expects **camelCase**. **Open task (W4 + dashboard owner): add a camelCase serializer at the API boundary** (or agree field names) so the wire format matches the frontend. The core stays snake_case internally.

Backend models (`core/schema.py`) → frontend wire (`domain.ts`):

| Backend (snake_case) | Frontend wire (camelCase) | Notes |
| --- | --- | --- |
| `SourceRef {doc_id, version, page, sheet, cells, section, url, retrieved_at}` | `Evidence.documentId`, `version`, `locator {page?, section?, sheet?, cells?}` | `locator_label()` gives a display string |
| `Evidence {ref, quote, verified}` | `Evidence {documentId, locator, excerpt, verified, unitId?, highlight?}` | `quote` → `excerpt` |
| `Finding {status, claim, due, searched, conflict, computed, urgency}` | `Finding {analysisStatus/state, summary, dueOn, resolver→owner, …}` | `status` → `analysisStatus`; `due` → `dueOn` |
| `Obligation {rule, anchor, offset_days, due, recurring, evidence}` | `Obligation {statement, dueRule, dueOn, dateAssertions}` | one obligation may carry several conflicting dates |
| known-absent docs (`core.absent()`) | `Finding.absentSources` | never evidence |

Open points for the dashboard owner to settle with W1/W4:

- `Finding.status` is `confirmed`/`conflict`/`not_found`/`needs_review`; the frontend `state` is narrower. Agree the mapping (`conflict`/`needs_review` → `needs_review`, `not_found` → `insufficient_evidence`) and map `resolver` → `owner`.
- Known-absent sources (GTC, PIP, Local Partners form, Reporting Forms) are not in the `documentId` enum by design; they surface via `absentSources`, never as evidence.
- For dashboard integration before the pipeline exists, the API layer (W4) serves `GET /findings`, `GET /obligations`, `POST /ask` returning `[]` or one clearly labelled placeholder (`"title": "CONTRACT EXAMPLE – not a finding"`) under `GG_FIXTURES=1`. Never put a real answer in a fixture.

## Workstreams

| Workstream | Owns | Status | Next deliverable |
| --- | --- | --- | --- |
| **W1 Core / ingest** | `schema.py`, `registry.py`, `ingest/`, `store.py`, `verify.py` | **Done** (committed, tested) | Maintain the contract; review additive field PRs |
| **W2 Extraction** | `llm.py`, `extract/` | `llm.py` **done**; `extract/` **todo** | Obligations ledger from 03 + call checklist from 01 (rule verbatim, unit id, anchor, offset — never a computed date); every quote passes `verify.py`. Parse the PMF (05) with code, not the model |
| **W3 Checks** | `checks/` | **Done** (oracles + `score_urgency`; `validate()` lives in `pipeline.py`) | Wire real extracted inputs from W2 |
| **W4 Reasoning + API** | `dispatch.py`, `findings.py`, `api/` | `dispatch.py` + the gate (`pipeline.py`) **done**; `findings.py` + `api/` **todo** | Finding drafts that pass `validate()`; FastAPI `GET /findings`/`/obligations` + `POST /ask`; the camelCase serializer |
| **W5 Eval / lead** | `tests/eval/`, `docs/DECISIONS.md`, merges | `scorer.py` **done**; gold **todo** | Hand-author `tests/eval/gold.json` for all 25 questions; wire the end-to-end eval once a tool returns findings; a test fails if `core/` or `tools/` import `tests/eval/` |

With two people: split the two tools (compliance / proposal) over the already-built shared core — see the per-tool prompts. With more, W2 and W4's `findings.py`/`api/` can run in parallel.

## Milestone order

1. **Milestone 1** (`docs/CURRENT_TASK.md`): reporting obligations and date/period conflicts, evaluated on guide questions 8, 11 and 24, end to end in the dashboard.
2. Then the build plan's checkpoints: single-source reads (Q3, 6, 12, 13, 14) → deterministic checks (Q7, 17, 18, 19, calendar) → conflicts and resolvers (Q4, 5, 11, 15, 24) and the ranked issues view (Q25) → eval pass and fixes.
3. Cut list and protected items are in build plan §9.
