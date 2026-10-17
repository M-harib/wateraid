# Prebuild review of the teammate PRD

Reviewed against the teammate text supplied on 2026-10-17. This design review predates the addition of source files `00`–`06`; its pack-availability notes are historical. No pack claim or question is answered here.

## PRD review, ordered by likely judging impact

| Priority | Issue | Concrete change |
| --- | --- | --- |
| High | Three tools plus review history, radar, and a full obligations ledger are too much for one day; a broad demo could miss the questions judges actually test. | Start from file `00`'s question list. Build and evaluate one compliance path with verified citations, then add proposal checks. Cut radar first. |
| High | The PRD says every finding has a verified quote, while parsed PDF tables and workbook rows may not survive punctuation normalization as literal substrings. A false verifier failure can hide a correct finding; a loose normalizer can validate the wrong text. | Preserve raw located source text and a separate display form. Test quote verification on real pack pages and cells. Show the citation as unverified when exact matching fails. |
| High | `confirmed` can sound like a final compliance conclusion, but the product requires human decisions and unreviewed extraction artifacts. | Split machine evidence state, analysis status, and human review status. Use wording such as `potential issue — review required` in the UI. |
| High | Date and threshold checks are only deterministic after the rule, anchor, units, and exception language have been extracted correctly. | Validate each input with a source reference. If an anchor or interpretation is ambiguous, show the alternatives and request clarification; do not compute a single authoritative date. |
| High | The PRD asks for document-version tracking but leaves the version of general terms and the consolidated agreement's effective date unresolved. | Build a document register from the actual pack before analysis. Record declared version, effective date if present, hash, and location. Flag unknown terms versions instead of assuming them. |
| Medium | Semantic grouping of obligations and claims can create false conflicts when scopes, time periods, or populations differ. | Compare exact identifiers first. Let the model propose other matches with evidence for both statements; require review of uncertain matches. |
| Medium | A full append-only correction system keyed to topic and evidence locations may consume build time and can misapply a decision after evidence changes. | For the demo, store simple review decisions separately from findings and bind them to a source-content fingerprint. Flag mismatches as stale. |
| Medium | A live radar has no supplied test set and introduces network reliability and current-date sourcing into a historical scenario. | Treat it as stretch work; use a fixed allowlist and show retrieval time only if the core compliance demo passes. |
| Medium | The model tier plan is sensible but may spend more on repeated extraction than expected. | Cache validated extraction by file hash, run a small evaluation subset during iteration, and use rules for routing when sufficient. |

The PRD is sound as written on source traceability, abstention, visible conflicts, no automatic certification, keeping gold answers out of product code, using code for arithmetic, and avoiding a vector database until measurements justify one. Keep those principles.

## Coverage map status

File `00` is now available and its 25 questions appear on page 3. An individual question-to-tool, source, and method map has not yet been prepared. For that later task, create one row per exact question with: question ID, user-facing task, needed source units, retrieval step, deterministic check, LLM step if any, expected answer type, resolver for a conflict, and evaluation outcome.

## One-day implementation plan (4–5 people)

| Order / checkpoint | Owner role | Work and dependency | Must work before moving on |
| --- | --- | --- | --- |
| 0. Pack intake | Domain/evaluation lead | Read file `00`, register versions and page/sheet locators, classify 25 questions; needed by everyone. | A reviewed question map and 5–6 representative evaluation cases. |
| 1. Evidence substrate | Ingestion engineer | Parse PDFs and workbooks into located raw units; depends on pack access. | A user can open a cited page or sheet/cell and see the original text/value. |
| 2. Core checks | Extraction/checks engineer | Extract and validate a narrow obligation/claim schema, compute a few high-value checks; depends on located units. | At least one correct cited finding, one visible conflict, and one honest abstention. |
| 3. Demo UI | Frontend engineer | Build a question entry or scan trigger, action queue, evidence drawer, and review control against stable fixture schemas; integrate with core checks. | A staff member can inspect evidence and record a decision end to end. |
| 4. Integration/evaluation | Fifth person if available; otherwise domain lead plus core engineer | Run the representative cases, fix unsupported claims and broken citations, measure latency/cost; depends on integrated flow. | Main demo flow and evaluated examples work on the actual pack. |

If behind: cut live radar, public-project search, broad proposal coverage, general chat, sophisticated urgency ranking, and durable review history, in that order. Keep evidence viewing, abstention, conflict display, and one human review action.

## Prompt design

All model output is parsed and schema-validated before use. Give each prompt only located source units and the document register; never ask a model to fabricate a source locator.

| Call | Inputs | Required output | Tier and key failure guard |
| --- | --- | --- | --- |
| Router, if rules are insufficient | Staff request and supported intents | Intent enum plus selected document IDs | Cheap model; reject unknown intents and route to a safe default. |
| Obligations extraction | Located agreement units and declared version | Obligation category, verbatim rule quote, locator, anchor/offset candidates, ambiguity flag | Cheap model for bulk work; verify every quote and leave uncertain anchors unresolved. |
| Precedence extraction | Located clause units from the actual agreement | Ordered parts with exact clause quotation and location | Stronger model only if clause structure is complex; never infer rank from document labels alone. |
| Call checklist extraction | Located funding-call units | Requirement text, category, quote, locator, conditions/exceptions | Cheap model; ensure each item traces to a call unit and review missing exceptions. |
| Finding draft | Retrieved claims, validated extracted facts, and code-side check outputs | Issue type, claim, supporting evidence IDs, explanation, uncertainty, proposed next step, resolver where applicable | Stronger model for ambiguous cross-document language; forbid new numbers, citations, and final verdicts. |
| Radar summary, stretch only | Approved URL content and retrieval timestamp | Signal, fit reason, URL, date, uncertainty | Cheap model; reject uncited claims and stale or failed fetches. |

## Decisions needed before building

| Question | Recommendation |
| --- | --- |
| Which part of the pack is the first demo? | Choose after mapping file `00`; favor a compliance case with a conflict and two locators. |
| What does `confirmed` mean? | Avoid it as an overall finding status. Track citation verification and human review separately. |
| How are versions assigned? | Use human-declared or document-explicit labels in the register; mark unknown rather than infer. |
| What is the review record for the prototype? | Start with a simple local append-only log keyed to finding and evidence fingerprint. |
| What is the implementation stack? | Prefer Python for ingestion and checks per team context; choose the smallest web stack the team can ship. |
| What qualifies as a passing answer? | Use the file `00` question map and a small hand-reviewed gold set, kept outside product code. |
