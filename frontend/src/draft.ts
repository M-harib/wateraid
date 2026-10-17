import { z } from 'zod'

const DraftSectionSchema = z.object({ id: z.string(), heading: z.string(), body: z.string(), citations: z.array(z.object({ documentId: z.string(), page: z.number().optional() })).default([]) })
const DraftSourceSchema = z.object({ id: z.string(), name: z.string(), kind: z.enum(['text', 'pdf']), addedAt: z.string(), pages: z.number().optional() })
const DraftSchema = z.object({
  title: z.string(),
  sections: z.array(DraftSectionSchema),
  sources: z.array(DraftSourceSchema),
  templateId: z.enum(['blank', 'gac-preliminary-2018']).default('blank'),
  approvedAt: z.string().nullable(),
})

export type Draft = z.infer<typeof DraftSchema>
export type DraftSection = z.infer<typeof DraftSectionSchema>
export type DraftSource = z.infer<typeof DraftSourceSchema>

const key = (projectId: string) => `grantguard.draft.v1.${projectId}`
export function emptyDraft(projectName: string): Draft {
  return { title: `${projectName} proposal`, sections: [{ id: crypto.randomUUID(), heading: 'Project overview', body: '', citations: [] }], sources: [], templateId: 'blank', approvedAt: null }
}
export function loadDraft(projectId: string, projectName: string): Draft {
  try {
    const stored = window.localStorage.getItem(key(projectId))
    if (stored) {
      const result = DraftSchema.safeParse(JSON.parse(stored))
      if (result.success) return result.data
    }
  } catch { /* An empty draft remains available. */ }
  return emptyDraft(projectName)
}
export function saveDraft(projectId: string, draft: Draft): Draft {
  const valid = DraftSchema.parse(draft)
  window.localStorage.setItem(key(projectId), JSON.stringify(valid))
  return valid
}
export function removeDraft(projectId: string) { window.localStorage.removeItem(key(projectId)) }
