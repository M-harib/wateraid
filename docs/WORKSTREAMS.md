# WORKSTREAMS.md

How the team builds the backend in parallel with the dashboard. The design is in `docs/Taps_for_Rights_Build_Plan.pdf` (dispatch map, checks, coverage map); this file says who owns which files, what to build first, and the contract between backend and frontend. The shared milestone is still the one in `docs/CURRENT_TASK.md`.

## Ground rules for every workstream

- Branch per workstream (`feat/w1-ingest`, `feat/w3-checks`, …); open small PRs into `main`. Only touch the files your workstream owns; ask the owner before editing someone else's.
- `backend/core/schema.py` is the contract. W1 owns it; any field change goes through a PR the dashboard owner reviews. Changes are additive: add optional fields, do not rename or remove.
- No pack answers in product code (`backend/`, `frontend/`). Expected answers live only in `eval/`. Unit tests use generic inputs, not the pack's figures.
- The model never computes dates, sums, percentages or thresholds. Code does; the model narrates code results and quotes sources.
- The scenario date is a parameter (`AS_OF = 2022-06-30`), never the system clock.
- Secrets (OpenRouter key) stay in `backend/.env`, which is gitignored. The frontend never calls a model.
- After substantial work, append to your workstream's section in `docs/HANDOFF.md`: what changed, commands you actually ran and their results, open risks.

## Layout

```text
backend/
  pyproject.toml        # uv, Python 3.12 (pin it; 3.14 lacks some wheels)
  core/
    schema.py           # W1 – the contract
    registry.py         # W1 – 7 pack files, sha256, declared versions, known-absent sources
    ingest/             # W1 – PDF page units, workbook cell units
    verify.py           # W1 – quote verifier
    llm.py              # W2 – model adapter (OpenRouter), retries, cache by file hash
    extract/            # W2 – obligations ledger, report indicators, call checklist
    checks/             # W3 – deterministic oracles + validate()
    dispatch.py         # W4 – intent -> docs -> checks -> tier
    findings.py         # W4 – draft, conflict grouping, resolver, urgency "why"
  api/main.py           # W4 – FastAPI routes, CORS for the Vite origin
  data/                 # generated units, extraction cache, findings.json (gitignored except fixtures)
  tests/
eval/                   # W5 – gold.yaml, score.py; never imported by backend/
frontend/               # dashboard owner
```

The build plan shows `core/` at the repo root; it lives under `backend/` here because `frontend/` already exists.

## Step 0 – contract first (W1, first 45 minutes, unblocks everyone)

1. Scaffold `backend/` (uv, FastAPI, Pydantic v2, PyMuPDF, openpyxl, pytest).
2. Write `core/schema.py` with the models below. Serialize camelCase on the wire (`alias_generator=to_camel`, `populate_by_name=True`) because the frontend already uses camelCase.
3. Serve `GET /findings`, `GET /obligations`, `POST /ask` from `api/main.py` returning `[]` or one clearly labelled placeholder (`"title": "CONTRACT EXAMPLE – not a finding"`) when `GG_FIXTURES=1`, so the dashboard can integrate before any pipeline exists. Never put a real answer in a fixture.

Contract (fields marked `+` are additions to the frontend's provisional view model in `frontend/src/domain.ts`; the frontend's Zod schemas ignore unknown fields, so these are safe to add before the UI renders them):

| Model | Fields |
| --- | --- |
| `Evidence` | `id`, `documentId` (`"00"`–`"06"`), `version` (declared or null), `locator {page?, section?, sheet?, cells?}`, `excerpt` (verbatim), `verified`, `+unitId` (`"03:p14"`, `"05:PMF!E14"`), `+highlight {charStart, charEnd}?` |
| `Obligation` | `id`, `title`, `category`, `statement`, `status`, `dueOn?`, `evidence[]`, `+dueRule {anchor, offsetDays, direction, recurring}?`, `+dateAssertions [{date, evidence}]` (one obligation may have several conflicting dates) |
| `Finding` | `id` (stable hash of kind + evidence unit ids), `kind`, `title`, `summary`, `priority`, `state`, `nextAction`, `owner?`, `dueOn?`, `evidence[]`, `+analysisStatus` (`answered`/`conflict`/`not_found`/`needs_review`), `+resolver` (`Water Care staff`/`GAC`/null), `+obligationId?`, `+dateCheck {ruleDate, assertedDate, mismatch, asOfStatus}?`, `+computed {check, inputs, result}?`, `+searched [doc/section]` (for abstentions), `+absentSources []` |
| `AskAnswer` | `answer`, `status`, `evidence[]`, `+findingIds []` |

Open contract points for the dashboard owner to settle with W1:

- `Finding.kind` is a four-value enum in the frontend; the dispatch map produces more kinds (cost-share conflict, arithmetic mismatch, missing approval, absent source…). Widen it to a string with a label map, or agree the full list now.
- Map `analysisStatus` to the frontend `state`: `conflict`/`needs_review` → `needs_review`, `not_found` → `insufficient_evidence`. Map `resolver` → `owner`.
- Known-absent sources (GTC, PIP, Local Partners form, Reporting Forms) are not in the `documentId` enum by design; they appear in `absentSources`, never as evidence.

## Workstreams

Each workstream's first deliverable has no dependency on the others except Step 0.

| Workstream | Owns | First deliverable (≈ first 2 h) | Done when |
| --- | --- | --- | --- |
| **W1 Core / ingest** | `schema.py`, `registry.py`, `ingest/`, `verify.py` | Step 0; then every PDF page and workbook cell as a located unit; registry with hashes and the known-absent list; quote verifier | All 42 PDF pages and both workbooks produce units with stable IDs; verifier passes tests on table-heavy pages (03 pp. 14–15, 04 pp. 4 and 7–8); workbook 06's example row and cached formula results are flagged so they cannot become evidence |
| **W2 Extraction** | `llm.py`, `extract/` | Model adapter with file-hash cache; obligations ledger from 03 (rule verbatim, unit id, anchor, offset – never a computed date); call checklist from 01 | Every extracted item validates against the schema and its quote passes `verify.py`; re-running hits the cache. Parse the PMF (05) with code, not the model |
| **W3 Checks** | `checks/` | Pure functions with pytest: `check_dates`, `check_sum`, `check_pct`, `check_threshold`, `check_cost_share`, `check_target_baseline`, `check_absent_source`, `score_urgency`, and `validate()` | Each check takes typed inputs and returns a typed result with its inputs echoed; tests use generic values; start now with hand-built inputs, swap in W2's output later |
| **W4 Reasoning + API** | `dispatch.py`, `findings.py`, `api/` | Rules-based dispatch for the milestone intents (reporting calendar, report consistency, cross-doc conflict); finding drafts that pass `validate()`; `python -m core.run_pipeline` writes `data/findings.json` | `GET /findings` and `GET /obligations` serve pipeline output that the dashboard renders with clickable citations; `POST /ask` routes to the same findings; the demo does not depend on a live model call |
| **W5 Eval / lead** | `eval/`, `docs/DECISIONS.md`, merges | `eval/gold.yaml` for all 25 questions written by hand from the pack (accepted answers, expected conflict and resolver, expected abstentions); `eval/score.py` that calls `POST /ask` | Scorer reports the five categories (verified citation, conflict + resolver, correct abstention, wrong, unsupported) and a hallucination rate; a test fails if `backend/` imports `eval/` |

With fewer than five people: merge W2 into W4 (one "LLM" person) and have the lead take W5.

## Milestone order

1. **Milestone 1** (`docs/CURRENT_TASK.md`): reporting obligations and date or reporting-period conflicts, evaluated on guide questions 8, 11 and 24, end to end in the dashboard.
2. Then the build plan's checkpoints: single-source reads (Q3, 6, 12, 13, 14) → deterministic checks (Q7, 17, 18, 19, calendar) → conflicts and resolvers (Q4, 5, 11, 15, 24) and the ranked issues view (Q25) → eval pass and fixes.
3. Cut list and protected items are in build plan §9.
