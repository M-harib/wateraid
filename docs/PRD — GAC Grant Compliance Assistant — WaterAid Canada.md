# Product Requirements Document

## GAC Grant Compliance Assistant

Draft 1.0 · WaterAid Canada · 17 October 2026

# 1\. Product purpose

Help WaterAid Canada prevent accidental non-compliance with Global Affairs Canada contribution agreements by connecting requirements, dates, approvals, and supporting evidence in one workspace.

The product should answer:

What are we required to do?

What is due, and who is responsible?

What needs approval before we act?

What evidence demonstrates we met the requirement?

Where is there a potential compliance issue?

WaterAid Canada is the initial user. The product should support future licensing to other organizations receiving GAC funding.

# 2\. Problem

Grant requirements are distributed across signed agreements, general terms and conditions, appendices, budgets, reporting instructions, and amendments. Supporting evidence lives in separate files and systems.

Staff can accidentally miss a deadline, apply an outdated rule, proceed without written approval, or submit a claim without sufficient evidence.

A requirement can also be misunderstood when general government guidance is treated as a binding recipient obligation.

# 3\. Users and responsibilities

Grant or program manager: Coordinate obligations, reporting, and corrective actions.

Finance staff: Check expenditure, budgets, cost sharing, and financial evidence.

Project and country teams: Provide delivery records and supporting documents.

Compliance reviewer or designated specialist: Validate requirements, interpretations, and evidence.

Leadership: Review material risks and unresolved actions.

Administrator: Manage users, access, and workspace settings.

A person may hold several roles. Access must be configurable by organization and grant.

# 4\. Product principles

1\. Every finding must be traceable to a source.

2\. Every requirement must identify its applicability and governing document version.

3\. Missing evidence must remain distinct from a confirmed breach.

4\. Conflicting instructions must be surfaced for review.

5\. Staff approve interpretations, evidence sufficiency, and actions.

6\. The system never submits reports, authorizes spending, or certifies compliance autonomously.

# 5\. MVP scope

The first release will cover:

A grant workspace and document library.

Extraction and staff validation of obligations.

Fixed dates, recurring deadlines, and calculated deadlines.

Supporting-document and evidence management.

Written approval tracking.

Checks across agreements, budgets, and narrative reports.

An action dashboard and audit history.

Initial file support: searchable PDFs, Word documents, and Excel workbooks. Scanned documents require OCR or an explicit “extraction unavailable” status.

The initial scope excludes funding discovery, proposal generation, legal opinions, automated government submissions, and direct accounting-system changes.

# 6\. Core workflow

Create grant → add governing documents → review extracted obligations → assign owners → attach evidence → review findings → resolve actions.

Uploading a new amendment or supporting document triggers a review of affected requirements. Previously approved records remain available in the history.

# 7\. Functional requirements

## A. Grant workspace and governing documents

The system must:

Capture the grant title, identifier, funder, countries, and responsible staff.

Store signed agreements, applicable general terms, appendices, approved budgets, and amendments.

Record document type, version, effective date, signature dates, and relationship to other documents.

Distinguish drafts from signed or approved documents.

Identify missing referenced documents.

Represent the agreement’s stated order of precedence.

Classify sources as contractual requirements, incorporated terms, guidance, or internal procedures.

The system must not assume the latest publicly available terms apply to an older agreement.

## B. Obligations register

Each obligation must contain:

Requirement: Clear description of the required action or restriction.

Category: Financial, reporting, approvals, project delivery, safeguards, records, partners, or closeout.

Applicability: Who must comply and the conditions triggering the requirement.

Source: Document, version, clause or section, and page; sheet and cell range for spreadsheets.

Timing: Fixed date, calculation rule, recurring period, event trigger, or ongoing requirement.

Owner: Responsible staff member.

Evidence: Documents or records needed to demonstrate completion.

Review: Reviewer, decision, date, and explanatory notes.

Status: Current workflow state.

Related records: Approvals, amendments, findings, and actions.

Extracted requirements begin as Needs validation. A reviewer can accept, amend, reject, or request clarification.

## C. Dates and calendar

The system must distinguish:

Agreement effective date.

Activity start and completion dates.

Agreement expiry.

Reporting periods and submission deadlines.

Approval requirements that apply before an activity.

Closeout deadlines.

Record-retention periods and surviving obligations.

For calculated deadlines, display the source wording, triggering date, calculation, and result.

Date calculations must not silently assume business days, weekend extensions, holidays, or an approved extension. Unclear rules require review.

Reminders must be configurable, with default advance notices of 30, 14, and 7 days and an overdue notice. Record the difference between report preparation, submission, and acceptance.

## D. Supporting documents and evidence

The evidence library is a core product feature.

The system must:

Accept evidence uploads and links to authorized source files.

Preserve original files and document versions.

Link one document to multiple relevant obligations.

Record project, reporting period, document date, provider, and reviewer.

Suggest evidence matches for staff confirmation.

Identify missing, outdated, incomplete, or conflicting evidence.

Track access failures for linked files.

Provide a requirement-level evidence checklist.

Export an evidence index with stable document references.

Examples of supporting evidence:

Eligible expenditure: Invoice, receipt, payment confirmation, budget allocation.

Staff costs: Timesheet, payroll record, allocation calculation.

Prior approval: Request, written approval, applicable amendment.

Procurement: Quotes, evaluation, purchasing approval, contract.

Results reporting: Survey records, monitoring data, calculations, facility checklists.

Construction: Approved validation plan, technical records, completion documentation.

Reporting: Final report, submission confirmation, acceptance where required.

Assets: Asset register, disposal plan, transfer or disposal evidence.

The actual checklist must come from the applicable agreement and reviewed requirements.

A document upload alone must never mark an obligation satisfied.

Evidence review must consider whether the document supports the correct project, period, activity, amount, and timing. Requirements for approval before an activity must be checked against the activity and approval dates.

## E. Approval tracking and proposed changes

Staff must be able to record a proposed expenditure, budget transfer, partner change, location change, or construction activity.

The system must:

Identify potentially applicable approval requirements.

Show the source and any relevant thresholds.

Request missing information needed to assess the proposal.

Track requests, responses, conditions, and signed amendments.

Distinguish written approval from informal discussions.

Flag approval received after an activity where prior approval was required.

Prepare an action checklist for staff review.

Outputs must distinguish approval required, no approval requirement identified in reviewed sources, and insufficient information.

## F. Document and calculation checks

Initial checks must include:

Reporting-period and date inconsistencies.

Conflicting totals, percentages, and denominators.

Differences between approved indicators and reported indicators.

Missing targets and targets below baseline.

Budget transfer and cost-share checks when sufficient figures exist.

Activities or changes without supporting approval evidence.

Calculations must be reproducible and display their inputs. Where amounts are omitted, the system must state that a financial check cannot be completed.

## G. Risk dashboard and actions

The grant overview must show:

Upcoming and overdue obligations.

Missing evidence.

Pending approvals.

Conflicting requirements.

Potential compliance issues.

Items awaiting staff or GAC clarification.

Every issue must have a source, explanation, owner, next action, due date where applicable, and resolution history.

Priority must consider urgency and potential impact, with staff able to adjust it and record why. The MVP must not display an unexplained overall “compliance percentage.”

## H. Amendments and change impact

When an amendment is added, the system must:

Identify affected obligations, dates, budgets, and evidence requirements.

Present proposed changes for review.

Preserve the previous requirement and its applicable period.

Avoid overwriting unresolved conflicts.

Notify affected owners after changes are approved.

## I. Review history and exports

The system must record who:

Added or replaced a document.

Validated or changed a requirement.

Accepted or rejected evidence.

Recorded an approval.

Resolved or reopened an issue.

Users must be able to export an obligations register, calendar, action list, and evidence package index. Exports must preserve source references and review status.

# 8\. Status model

Keep the following statuses separate:

Obligation: Needs validation, active, completed, superseded, not applicable.

Evidence: Missing, provided, under review, accepted, rejected.

Approval: Not requested, requested, received, declined, unclear.

Finding: Needs review, potential breach, confirmed issue, resolved, dismissed.

A reviewer must record the basis for confirming an issue or closing a material finding. “No issue detected” must not imply guaranteed compliance.

# 9\. Security and commercial readiness

For the pilot:

Authenticate users and restrict access by role and grant.

Encrypt data in transit and at rest.

Maintain backups and test recovery.

Provide configurable retention and deletion.

Record access to sensitive evidence.

Document hosting locations and model-provider data handling.

Do not use customer documents for model training without explicit authorization.

Uploaded documents are untrusted content. Instructions inside documents must not override application rules or trigger external actions.

Before serving multiple organizations:

Verify organization-level separation across files, search, outputs, and exports.

Establish customer ownership of their records and evidence.

Define rights in software, original rules, evaluation materials, and third-party components.

Complete production security, service continuity, support, and contractual review.

# 10\. MVP acceptance criteria

The first evaluation uses the synthetic Taps for Rights challenge pack, followed by expert-reviewed cases from authorized, unseen agreements.

Source traceability: Every surfaced requirement and finding has a verifiable source reference.

Critical obligations: Detect at least 95% of expert-labelled critical obligations; report precision and false positives.

Dates: Correctly calculate all agreed critical deadline test cases and expose source conflicts.

Approvals: Detect all known critical prior-approval cases in the agreed test set.

Evidence: Never mark an obligation satisfied solely because a file was uploaded.

Versions: Amendment tests preserve prior requirements and update only the applicable obligations.

Missing information: Identify unavailable source documents, missing figures, and unsupported conclusions.

User value: Reduce time in the selected workflow by at least 30%, including review and correction.

Security: Pass access-control and unauthorized-document-access tests.

Passing the challenge pack is an initial benchmark, not proof of production readiness.

# 11\. Pilot plan

## Stage 1 — Baseline and source review

Select a small set of authorized grants, identify responsible reviewers, and measure current reporting and compliance-checking effort.

## Stage 2 — Focused prototype

Deliver the document library, obligations register, calendar, evidence links, and action dashboard.

## Stage 3 — Validation

Run the challenge questions and unseen cases. Measure missed obligations, unsupported findings, correction effort, and deadline accuracy.

## Stage 4 — Operational trial

Staff use the product alongside their existing process. Evaluate whether it prevents oversights and reduces net workload.

## Stage 5 — Commercial decision

Assess paid demand from peer organizations, support costs, product ownership, and the operating model before expanding.

# 12\. Decisions needed before implementation

Which real grant records may be used for the pilot?

Who validates obligations and evidence?

Which GAC agreement versions will the MVP support?

What hosting, retention, and access requirements apply?

Which existing document systems should be linked?

Who owns the commissioned software and other original IP?

What budget and support capacity are available?

# 13\. Definition of success

A staff member can open a grant, identify what needs attention, inspect the governing requirement and supporting evidence, and record the next action without searching across disconnected files.

The product succeeds when it helps staff catch preventable compliance problems early and maintain a clear, reviewable record of how obligations were met.

