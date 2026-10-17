import { z } from 'zod'
import { FindingSchema, RequirementSchema, type DashboardData, type Finding, type Requirement } from './domain'

export type DashboardConnection =
  | { mode: 'preview'; data: DashboardData }
  | { mode: 'connected'; data: DashboardData; message?: string }
  | { mode: 'unavailable'; data: DashboardData; message: string }

const FindingListSchema = z.union([z.array(FindingSchema), z.object({ findings: z.array(FindingSchema) })])
const RequirementListSchema = z.union([z.array(RequirementSchema), z.object({ obligations: z.array(RequirementSchema) })])
const AnswerSchema = z.object({
  answer: z.string().min(1),
  status: z.enum(['answered', 'conflict', 'not_found', 'needs_review']),
  evidence: z.array(z.object({ documentId: z.enum(['00', '01', '02', '03', '04', '05', '06']), locator: z.object({ page: z.number().int().positive().optional(), section: z.string().optional(), sheet: z.string().optional(), cells: z.string().optional() }), excerpt: z.string().optional() })).default([]),
}).superRefine((answer, context) => {
  if (answer.status === 'answered' && answer.evidence.length === 0) context.addIssue({ code: 'custom', path: ['evidence'], message: 'An answer needs cited evidence.' })
  if (answer.status === 'conflict' && answer.evidence.length < 2) context.addIssue({ code: 'custom', path: ['evidence'], message: 'A conflict needs both source statements.' })
  answer.evidence.forEach((item, index) => {
    if (!item.locator.page && !item.locator.section && !(item.locator.sheet && item.locator.cells)) context.addIssue({ code: 'custom', path: ['evidence', index, 'locator'], message: 'Source location is required.' })
  })
})
export type AskAnswer = z.infer<typeof AnswerSchema>

const previewData: DashboardData = {
  projectName: 'Taps for Rights',
  asOf: '2022-06-30',
  findings: [],
  requirements: [],
}

export async function loadDashboard(): Promise<DashboardConnection> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '')
  if (!baseUrl) return { mode: 'preview', data: previewData }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)

  try {
    const findingsResponse = await fetch(`${baseUrl}/findings`, { signal: controller.signal })
    if (!findingsResponse.ok) throw new Error(`Findings service returned ${findingsResponse.status}`)
    const parsedFindings = FindingListSchema.safeParse(await findingsResponse.json())
    if (!parsedFindings.success) throw new Error('Findings response did not match the provisional frontend schema')
    const findings: Finding[] = Array.isArray(parsedFindings.data) ? parsedFindings.data : parsedFindings.data.findings

    let requirements: Requirement[] = []
    let message: string | undefined
    try {
      const obligationsResponse = await fetch(`${baseUrl}/obligations`, { signal: controller.signal })
      if (obligationsResponse.ok) {
        const parsedRequirements = RequirementListSchema.safeParse(await obligationsResponse.json())
        if (!parsedRequirements.success) throw new Error('Obligations response did not match the provisional frontend schema')
        requirements = Array.isArray(parsedRequirements.data) ? parsedRequirements.data : parsedRequirements.data.obligations
      } else {
        message = `Obligations service returned ${obligationsResponse.status}`
      }
    } catch (error) {
      message = error instanceof Error ? error.message : 'Obligations service is unavailable'
    }

    return { mode: 'connected', data: { ...previewData, findings, requirements }, message }
  } catch (error) {
    return {
      mode: 'unavailable',
      data: previewData,
      message: error instanceof Error ? error.message : 'Could not reach the analysis service',
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function askQuestion(question: string): Promise<AskAnswer> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '')
  if (!baseUrl) throw new Error('Connect the analysis service to ask a question.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${baseUrl}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Question service returned ${response.status}`)
    const parsed = AnswerSchema.safeParse(await response.json())
    if (!parsed.success) throw new Error('Question response did not match the provisional frontend schema')
    return parsed.data
  } finally {
    window.clearTimeout(timeout)
  }
}
