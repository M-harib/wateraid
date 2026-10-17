import { z } from 'zod'
import { FindingSchema, RequirementSchema, type DashboardData, type Finding, type Requirement } from './domain'

export type DashboardConnection =
  | { mode: 'preview'; data: DashboardData }
  | { mode: 'connected'; data: DashboardData; message?: string }
  | { mode: 'unavailable'; data: DashboardData; message: string }

const FindingListSchema = z.union([z.array(FindingSchema), z.object({ findings: z.array(FindingSchema) })])
const RequirementListSchema = z.union([z.array(RequirementSchema), z.object({ obligations: z.array(RequirementSchema) })])

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
