import { z } from 'zod'
import type { Finding } from './domain'

export const ReviewDecisionSchema = z.enum(['confirmed', 'corrected', 'dismissed', 'escalated', 'clarification_requested'])
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>

const ReviewRecordSchema = z.object({
  id: z.string(),
  findingId: z.string(),
  findingTitle: z.string(),
  fingerprint: z.string(),
  decision: ReviewDecisionSchema,
  note: z.string(),
  correctedValue: z.string().optional(),
  recordedAt: z.string(),
})

export type ReviewRecord = z.infer<typeof ReviewRecordSchema>
const storageKey = 'grantguard.review-records.v1'

export function evidenceFingerprint(finding: Finding): string {
  return JSON.stringify({
    kind: finding.kind,
    title: finding.title,
    summary: finding.summary,
    nextAction: finding.nextAction,
    evidence: finding.evidence.map((evidence) => ({
      id: evidence.id,
      documentId: evidence.documentId,
      version: evidence.version,
      locator: evidence.locator,
      excerpt: evidence.excerpt,
      verified: evidence.verified,
    })),
  })
}

export function loadReviews(): ReviewRecord[] {
  try {
    const value = window.localStorage.getItem(storageKey)
    if (!value) return []
    const parsed = z.array(ReviewRecordSchema).safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export function appendReview(record: ReviewRecord): ReviewRecord[] {
  const next = [...loadReviews(), record]
  window.localStorage.setItem(storageKey, JSON.stringify(next))
  return next
}

export function latestReviewFor(findingId: string, records: ReviewRecord[]): ReviewRecord | undefined {
  return [...records].reverse().find((record) => record.findingId === findingId)
}
