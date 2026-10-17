# DECISIONS.md

Record decisions here with their status and reason. Do not turn a proposal into a binding rule without evidence or a team decision.

| Decision | Status | Reason / next check |
| --- | --- | --- |
| Use `AGENTS.md` as shared instructions, with `CLAUDE.md` linking to it | Accepted for this repository setup | Prevent divergent agent guidance. |
| Start with a cited compliance vertical slice; consider proposal checking next and funding radar last | Provisional | File `00` page 1 says depth beats breadth and calls funding radar a stretch tool. |
| Keep the team-described Python core as the default; use TypeScript if needed for the web UI | Provisional | Teammate brief says Python is the team's main language; no stack exists yet. |
| Use human review for conflicts, even when precedence context is known | Accepted product principle | The teammate brief and user's guidance both require visible conflict and human decision. |
| Keep pack-specific answers out of product code | Accepted product principle | The pipeline must discover findings and support them with sources. |
| Use 30 June 2022 as the case date and the 25 file `00` questions as evaluation cases | Verified from guide | File `00` pages 1 and 3. Verify question-specific facts in the relevant source documents. |
| Choose parser, model tiers, schemas, storage, urgency rubric, and exact UI stack | Open | Decide after pack inspection and a tested vertical slice. |
