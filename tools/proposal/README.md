# Proposal assistant

Deliverable on `feat/proposal`: a checking-only view over the shared finding store,
covering call/proposal requirements, contribution and construction conflicts,
proposal/report claim grounding, PMF quality, and financial-reviewer preparation.
Acceptance: both-document checklist evidence (or an explicit searched-proposal gap),
verified quotations, deterministic numeric comparisons, named conflict resolvers,
known-absent abstention, and passing synthetic unit tests and source-pack eval checks.

The shared prerequisites already exist. This implementation imports `core.llm`,
`core.dispatch`, `core.checks` and `core.pipeline` directly. `FakeLLM` is the supported
test double; there is no second production pipeline or import of `tools.compliance`.
No schema shapes, shared extraction modules, frontend files or API-owned files change.

## Use from the API workstream

```python
from core import Core, OpenRouterLLM
from tools.proposal import ProposalAssistant

# After the shared Core has been ingested in the application's async lifespan:
proposal = ProposalAssistant(core, OpenRouterLLM())
await proposal.startup()  # warms the three priority intents, checklist and reviewer mapping

await proposal.ask(question)        # Finding.to_dict(), canonical snake_case
await proposal.checklist()          # one serialized row per extracted call requirement
await proposal.reviewer_questions() # file 06 reviewer rows -> cited proposal sections
await proposal.issues()             # proposal findings from the shared store
```

Keep one instance per application. Call `startup()` once after `core.load()`, not on
each request. W4 owns HTTP routes, CORS and the camelCase frontend serializer; these
functions are ready to mount there. `finding(question)` returns the dataclass for
the shared evaluator; `ask(question)` returns its JSON-ready `to_dict()` output.

Cache keys include source text/locators/versions, absent-registry metadata, question,
prompt version/content, scenario date and configured models. The cache is the existing
in-memory `FindingStore`; restart re-runs analysis. Operational failures are retryable,
not cached as successful answers. Checklist and reviewer views are stored in the
existing `Finding.computed.result`, without extending the canonical schema.

## Run locally

Configure `OPENROUTER_API_KEY` in the gitignored repository-root `.env` (copy
`.env.example` locally). The shared client reads environment variables; uv loads the
file for the CLI. Never paste the key into prompts, output files or frontend config.

```powershell
uv run --env-file .env python -m tools.proposal
uv run --env-file .env python -m tools.proposal --view checklist
uv run --env-file .env python -m tools.proposal --view quality
uv run --env-file .env python -m tools.proposal --question "Which claims need substantiation?"
uv run --env-file .env python -m tools.proposal --output "$env:TEMP/grantguard-proposal.json"
uv run pytest -q
uv run --env-file .env python -m tests.eval.run_proposal
```

Without a configured model, the CLI returns explicit `needs_review` diagnostics and
exits nonzero; it does not fabricate an offline answer. All provider and filesystem
I/O is awaited or offloaded to a thread, including shared ingest. Model requests are
bounded to two concurrent calls with a 90-second timeout per request.

## Evidence and interpretation limits

- Physical PDF page numbers are used, including any pack cover pages.
- When a model supplies the wrong page ID for an exact quote, the verifier relocates
  it only when that quote occurs on exactly one allowed unit. Ambiguous and invented
  quotes still fail; model-supplied versions and verification flags are ignored.
- Checklist `met` describes the cited proposal response, not external verification or
  a funding decision. Eligibility documents that are absent cannot be certified.
- `not_addressed` records every proposal page supplied to the assessment; absence is
  a model judgment, not a proof that no relevant wording exists.
- Cost share uses percentages parsed from verified quotes and the shared oracle.
  Construction classification and claim grounding are model judgments; the code
  compares classifications, preserves quotes and leaves decisions to people.
- PMF baselines are compared to targets by code, retaining disaggregated percentages
  and raw cells. A target below baseline can be appropriate for a decreasing measure.
  For qualitative PMF judgments, the model selects row IDs and the stored full row is
  cited; model-reconstructed spreadsheet text is never treated as a verbatim quote.
- Only file 06's reviewer-question rows enter this tool. Example rows and cached
  budget formulas cannot become its evidence. ESDC reference forms are excluded.
- The current shared gate retries `needs_review` even for legitimate qualitative
  uncertainty. The proposal adapter preserves a validated qualitative review draft
  on those requests instead of re-querying the model to manufacture certainty.
  Invalid extractions still receive repair/escalation. A valid terminal
  `needs_review` remains cached.
- Expected pack answers belong only in `tests/eval/`. Unit tests use made-up inputs.
  The pack fixture test verifies source quotations, oracles and serialization with
  `FakeLLM`; it does **not** establish live extraction quality. The opt-in evaluator
  calls the real model and checks required citations and computed values in addition
  to the shared scorer (which currently omits citation checks for conflict results).
