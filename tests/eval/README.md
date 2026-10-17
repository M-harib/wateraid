# Eval tests (end-to-end accuracy)

These score the **whole pipeline** — question → dispatch → checks → draft → verify →
finding — against hand-authored gold answers for the 25 test questions (file 00, p.3).
They are distinct from the unit tests in `tests/` (which test core modules in isolation).

**Status: scorer ready; gold + pipeline pending.** `scorer.py` is built and tested.
What's left is (a) the tools producing `Finding`s and (b) the team authoring the
remaining gold entries. Wire the end-to-end eval once a tool returns findings.

## Design (locked — see `Taps_for_Rights_Build_Plan.pdf` §9)

- **Gold file** (`tests/eval/gold.json`) — hand-written by the team, one entry per
  question: expected status, expected resolver (for conflicts), and the source
  locators that must appear. Stored outside product code; the pipeline must never
  read it (Principle 6: the tool discovers answers, it does not encode them).
- **Scorer** (`tests/eval/scorer.py`) — `score(finding, gold)` returns one category;
  `hallucination_rate(findings)` reuses the verifier's `verified` flags.
- **Scoring categories** per question:
  `correct_with_citation | correct_conflict_with_resolver | correct_abstention | wrong | unsupported`.
- **Cost control** — a 5–6 question subset marker (`@pytest.mark.eval_subset`) for
  iteration; the full 25 run at checkpoints.

## Gold entry shape

```json
{ "id": "Q11",
  "question": "When is the final report due? Is the agreement consistent on this?",
  "expect_status": "conflict",
  "expect_resolver": "gac",
  "must_cite": ["03:App.D 4.12", "03:App.D 4.13", "04:§12"] }
```
