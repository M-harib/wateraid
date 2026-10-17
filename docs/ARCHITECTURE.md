# ARCHITECTURE.md

## Proposed vertical slice

```text
Source PDFs / workbooks
  → document registry and located text units
  → structured extraction with schema validation
  → normalized obligations, claims, indicators, and source references
  → deterministic checks plus qualified LLM analysis
  → quote verification and reviewable findings
  → action queue, evidence view, and human review log
```

This is a proposed design, not an implemented system. Adjust it after inspecting the actual pack and evaluating a narrow end-to-end slice.

## Boundaries

- **Ingest:** Keep one located unit per physical PDF page where possible. Preserve workbook sheet names and cell ranges, including headers, title rows, and version cues. Register document identity and human-declared version; never infer a version from model prose.
- **Extraction:** Use typed, validated output for obligations, call requirements, PMF indicators, and cited precedence rules. Store exact source text alongside normalized values. An extracted artifact may be used before review only while visibly marked unreviewed.
- **Comparison:** Code computes dates, percentages, threshold tests, and joins by stable indicator code or reviewed obligation identity. The model can suggest semantic matches and explain ambiguity, but an uncertain match remains reviewable.
- **Findings:** Each finding carries a stable identity, issue type, status, reason, source evidence, verification state, and review status. Conflicts retain both statements and identify who should resolve the question. A precedence note must cite the underlying clause.
- **Review:** Store human decisions separately from regenerated findings. If evidence locations or content behind a decision change, flag the decision as stale. A later resolution becomes new citable evidence.
- **UI:** Show a short action queue and allow opening the exact page or sheet/cell evidence. Do not bind UI components directly to raw model responses.

## Model use and cost

Keep model calls behind an adapter. Prefer rules for routing when adequate, a cheaper model for repeatable extraction, and a stronger model only for difficult cross-document language analysis. Validate every response. Use a code-based quote verifier before marking text as verified. Cache extraction by document version and content hash; do not add a vector database unless measured retrieval cost or quality demands it.

## Unresolved design choices

The exact schema, parser, web stack, storage format, model tiers, and urgency rubric remain open until the pack is inspected and a first slice is tested. Record choices in `docs/DECISIONS.md` before treating them as settled.
