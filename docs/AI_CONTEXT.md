# AI_CONTEXT.md

## Project

**GrantProof** (formerly GrantGuard) is the working name for a one-day WaterAid Canada Challenge A6 prototype. The supplied pack is a fictional **Water Care / Taps for Rights** case. File `00` confirms the case date, core pack, and judge questions; verify any grant-specific clause or claim in its original file before using it.

## User problem

Program, monitoring and evaluation, finance, and proposal staff must compare requirements and commitments spread across a funding call, proposal, contribution agreement, logic model and PMF, budget, and results report. The product's central question is: **What needs attention now, and which exact evidence supports it?**

## Proposed product flow

Load source documents → preserve document identity and version → extract cited facts → validate quotations and structured output → normalize obligations, indicators, and claims → run deterministic comparisons → draft reviewable findings → show an action queue with evidence → record human decisions.

The first deliverable is a credible compliance flow. The teammate brief also proposes a proposal assistant and a live funding radar; both are conditional on time and source availability. Depth and traceability take priority over showing three shallow tools.

## Source-pack intake

Files `00`–`06` are now in `assets/`. File `00` page 3 lists 25 judge questions. Inspect each relevant original PDF page or workbook sheet before citing a clause, implementing a pack-specific rule, or asserting a conflict. Record declared versions, PDF pages, and workbook sheet/cell locations when ingested.

File `00` page 1 sets the compliance scenario as of **30 June 2022**. A future funding radar would use current retrieval dates; do not mix those time frames.

## Success and limits

The demo should let a staff member open a potential issue, see both sides of a conflict or a missing piece of evidence, and decide what to do. A finding is a review aid, not a compliance certification. If a question cannot be answered from inspected source units, state what was searched and abstain.

Evaluation should use the pack's judge questions once available: verified citation, correctly flagged conflict and resolver, correct abstention, wrong answer, and unsupported answer. Track unverifiable quotations separately. Keep gold answers outside product code.
