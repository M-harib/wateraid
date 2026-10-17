import { z } from 'zod'

const LocalProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  organization: z.string().trim().max(80),
  createdAt: z.string().datetime(),
})

export type LocalProject = z.infer<typeof LocalProjectSchema>
export const demoProjectId = 'taps-for-rights'
const storageKey = 'grantguard.project-shells.v1'

export function loadLocalProjects(): LocalProject[] {
  try {
    const value = window.localStorage.getItem(storageKey)
    if (!value) return []
    const parsed = z.array(LocalProjectSchema).safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export function saveLocalProjects(projects: LocalProject[]): LocalProject[] {
  const validated = z.array(LocalProjectSchema).parse(projects)
  window.localStorage.setItem(storageKey, JSON.stringify(validated))
  return validated
}

export function createLocalProject(name: string, organization: string): LocalProject {
  return LocalProjectSchema.parse({
    id: crypto.randomUUID(),
    name: name.trim(),
    organization: organization.trim(),
    createdAt: new Date().toISOString(),
  })
}
