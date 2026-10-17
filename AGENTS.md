# AGENTS.md

## What we are building

**GrantGuard** is a one-day prototype for WaterAid Canada Challenge A6. The supplied hackathon case is a **fictional Water Care** project called *Taps for Rights*; do not describe its facts as real WaterAid activity. The goal is to help grant staff see requirements, reported results, conflicts, and due dates with evidence they can inspect. The assistant flags issues; staff make decisions.

The participant guide, `assets/00_Start_Here_A6_Taps_for_Rights.pdf`, is the challenge source of truth. It says depth beats breadth, sets the case date to **30 June 2022**, and lists 25 judge questions on page 3. Read it before planning a feature. Never hardcode its answers into product code.

## Source pack

| File | Use |
| --- | --- |
| `assets/00_Start_Here_A6_Taps_for_Rights.pdf` | Challenge rules, scope, and judge questions. |
| `assets/01_Funding_Call_GAC_2018.pdf` | Funding-call requirements for proposal checks. |
| `assets/02_Preliminary_Proposal_Taps_for_Rights.pdf` | Preliminary proposal claims. |
| `assets/03_Contribution_Agreement_Taps_for_Rights.pdf` | Agreement obligations and any documented precedence rule. |
| `assets/04_Year3_Results_Report_Taps_for_Rights.pdf` | Reported Year 3 claims and dates. |
| `assets/05_Logic_Model_and_PMF_Taps_for_Rights.xlsx` | Approved results framework, indicators, baselines, and targets. |
| `assets/06_Budget_Template_Taps_for_Rights.xlsx` | Budget categories and rules; the guide says it has no budget figures. |

Other files in `assets/` are outside this core pack unless the current task explicitly uses them. Read the relevant original pages or sheets before making a grant claim. Record document versions from the source or mark them unknown. The guide mentions Article 1.3 of the agreement; read the actual clause before applying any precedence rule.

## Build scope

Start with **one working compliance flow**, not three partial tools. The default first feature is reporting obligations and cross-document date or reporting-period conflicts using the agreement and Year 3 report. It should produce a reviewable item with both sources, a reason for the flag, an evidence view, and a human action. Use guide questions 8, 11, and 24 as evaluation cases, without coding their answers. Add PMF, budget, or proposal checks only after this flow works. Funding radar is stretch work.

`docs/CURRENT_TASK.md` records the shared milestone. Each teammate should define their own narrow deliverable and acceptance criteria in their branch or PR before coding. Do not infer an assignment from example tasks in older chat or docs. Keep each deliverable small enough to finish and verify in a day.

`docs/Taps_for_Rights_Build_Plan.pdf` is the current working plan for the shared pipeline and API; `docs/WORKSTREAMS.md` records file ownership and the initial contract. Read both before changing a shared contract. The plan proposes one Q&A core with issues, obligations, and calendar as views; `backend/core/schema.py` is intended to become the backend/frontend contract. The plan guides implementation, while the original pack remains the authority for case facts.

## Rules for findings

- **Sources for truth. Code for math. Models for language. Humans for decisions.** Use code for dates, sums, percentages, thresholds, and joins on stable identifiers. Use a model for extraction or ambiguous language only when needed.
- Never invent an obligation, deadline, amount, approval, indicator, result, citation, or version. When evidence is absent, say `Insufficient evidence` or `Needs clarification` and say which documents were checked.
- A material finding must carry the document name and version (or `unknown`), page and section or sheet and cell range, supporting text or value, why it was flagged, uncertainty, and review status. Verify quotations against the cited source unit before marking them verified.
- Preserve both sides of a conflict. Show any applicable precedence clause with its own citation, and leave the issue for human review. Do not announce a final compliance verdict.
- Keep model output behind a validated schema before checks or UI use. Keep human corrections separate from generated findings so a rerun cannot silently overwrite a decision.
- Offer staff review actions: confirm, correct, dismiss, escalate, and request clarification. A simple local record is enough for the prototype.
- Treat **30 June 2022** as the historical case date. A future live funding feature would need its own current retrieval date.

## Engineering choices

The team brief says Python is the main language; prefer it for document processing and checks. Use TypeScript for the web UI if that fits the selected stack. Choose the simplest tools already working in the repository. Keep API keys server-side and external model calls behind an adapter. Cache or reuse extraction when practical, but do not add authentication, a database, vector search, calendar integrations, or production connections for this first flow.

The model budget is constrained. Use rules or a cheaper model for routine extraction and routing; reserve a stronger model for difficult comparisons. Test quality on a small set of guide questions before expanding coverage.

Before parallel implementation, agree on one small finding/evidence contract between the dashboard and pipeline owners. A finding needs an ID, type, short title, explanation, review state, and evidence list; each evidence item needs a document ID, version, locator, quoted text or value, and verification state. The frontend can use a fixture of that contract while the pipeline is built. Coordinate contract changes explicitly so teammates do not build incompatible shapes.

## How agents work together

1. Read this file, the relevant pack sources, `docs/CURRENT_TASK.md`, `docs/HANDOFF.md`, and `docs/DECISIONS.md`. Supporting docs may describe an earlier repository state; check `assets/` and the current code directly.
2. Work on a separate branch. Inspect `git status` and the existing implementation. State your deliverable, acceptance criteria, and expected files before editing. Coordinate shared files and contracts with their owner. Do not undo a teammate's changes or expand scope without recording a decision.
3. Keep functions and domain types small and explicit. Keep raw model responses out of UI components.
4. After substantial work, update `docs/HANDOFF.md`: what changed, commands actually run, failures, open risks, and the next review step. A reviewer should inspect correctness, unsupported rules, missing citations, deterministic logic, and scope.

Run relevant tests, type checks, lint, and a build when configured. Manually exercise the main demo flow when possible. Report exactly what passed and what was not run. Do not claim compliance or verification that the tool did not establish.
