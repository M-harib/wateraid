import { z } from 'zod'

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  documentId: z.enum(['00', '01', '02', '03', '04', '05', '06']),
  version: z.string().min(1).nullable(),
  locator: z.object({
    page: z.number().int().positive().optional(),
    section: z.string().optional(),
    sheet: z.string().optional(),
    cells: z.string().optional(),
  }),
  excerpt: z.string().optional(),
  verified: z.boolean(),
}).superRefine((evidence, context) => {
  const locator = evidence.locator
  if (!locator.page && !locator.section && !(locator.sheet && locator.cells)) {
    context.addIssue({ code: 'custom', path: ['locator'], message: 'Evidence needs a page, section, or sheet and cell range.' })
  }
  if (evidence.verified && !evidence.excerpt?.trim()) {
    context.addIssue({ code: 'custom', path: ['excerpt'], message: 'Verified evidence needs an excerpt.' })
  }
})

export const FindingSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
  state: z.enum(['needs_review', 'needs_clarification', 'insufficient_evidence']),
  nextAction: z.string().min(1),
  owner: z.string().nullable().optional(),
  resolver: z.string().nullable().optional(),
  dueOn: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema).min(1),
}).superRefine((finding, context) => {
  if (finding.kind === 'deadline_conflict' && finding.evidence.length < 2) {
    context.addIssue({
      code: 'custom',
      path: ['evidence'],
      message: 'A deadline conflict needs at least two cited statements.',
    })
  }
})

export const RequirementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  statement: z.string().min(1),
  status: z.enum(['unreviewed', 'needs_clarification', 'reviewed']),
  dueOn: z.string().nullable().optional(),
  evidence: z.array(EvidenceSchema).min(1),
})

export const DashboardSchema = z.object({
  projectName: z.string().min(1),
  asOf: z.string().min(1),
  findings: z.array(FindingSchema),
  requirements: z.array(RequirementSchema).default([]),
})

export const ProposalChecklistRowSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  requirement: z.string().min(1),
  status: z.enum(['met', 'not_met', 'unclear', 'not_addressed']),
  reason: z.string().min(1),
  // Tolerant on purpose: one malformed row must not reject the whole proposal view.
  evidence: z.array(EvidenceSchema).default([]),
  searched: z.array(z.string()).default([]),
  // Model-supplied; may be names or registry records ({ doc_id, title, ... }).
  absentSources: z.array(z.unknown()).default([]).transform((items) => items.map(absentSourceLabel)),
  computed: z.unknown().nullable().optional(),
})

function absentSourceLabel(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>
    if (typeof record.title === 'string') return record.title
    if (typeof record.doc_id === 'string') return record.doc_id
  }
  return 'Referenced source not in the pack'
}

export const ReviewerQuestionSchema = z.object({
  question: EvidenceSchema,
  proposal: z.array(EvidenceSchema),
  status: z.enum(['mapped', 'not_addressed']),
  reason: z.string().min(1),
})

export const ProposalWorkspaceSchema = z.object({
  findings: z.array(FindingSchema),
  checklist: z.array(ProposalChecklistRowSchema),
  reviewerQuestions: z.array(ReviewerQuestionSchema),
  failures: z.array(z.string()),
})

export type Evidence = z.infer<typeof EvidenceSchema>
export type Finding = z.infer<typeof FindingSchema>
export type Requirement = z.infer<typeof RequirementSchema>
export type DashboardData = z.infer<typeof DashboardSchema>
export type ProposalChecklistRow = z.infer<typeof ProposalChecklistRowSchema>
export type ProposalWorkspace = z.infer<typeof ProposalWorkspaceSchema>
export type ReviewerQuestion = z.infer<typeof ReviewerQuestionSchema>

export function evidenceLocation(evidence: Evidence): string {
  const parts: string[] = []
  if (evidence.locator.page) parts.push(`Page ${evidence.locator.page}`)
  if (evidence.locator.section) parts.push(evidence.locator.section)
  if (evidence.locator.sheet) parts.push(`Sheet ${evidence.locator.sheet}`)
  if (evidence.locator.cells) parts.push(evidence.locator.cells)
  return parts.join(' · ') || 'Location not supplied'
}
