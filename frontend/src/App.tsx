import { useEffect, useState } from 'react'
import { Dashboard, type DashboardSection } from './Dashboard'
import { LandingPage } from './LandingPage'
import { ProjectsPage } from './ProjectsPage'
import { demoProjectId } from './projects'
import { applyTheme, readTheme } from './theme'

type Route = { kind: 'landing' } | { kind: 'projects'; projectId?: string; projectSection?: 'intake' | 'draft' } | { kind: 'dashboard'; section: DashboardSection }

const sections: DashboardSection[] = ['intake', 'draft', 'overview', 'issues', 'obligations', 'calendar', 'documents', 'reviews']

function readRoute(): Route {
  const [, root, section, projectSection] = window.location.pathname.split('/')
  if (root === 'projects' && section === demoProjectId) {
    if (projectSection === 'ask') return { kind: 'dashboard', section: 'documents' }
    return { kind: 'dashboard', section: sections.includes(projectSection as DashboardSection) ? projectSection as DashboardSection : 'intake' }
  }
  if (root === 'projects') return { kind: 'projects', projectId: section, projectSection: projectSection === 'draft' ? 'draft' : 'intake' }
  if (root !== 'dashboard') return { kind: 'landing' }
  if (section === 'ask') return { kind: 'dashboard', section: 'documents' }
  return { kind: 'dashboard', section: sections.includes(section as DashboardSection) ? section as DashboardSection : 'overview' }
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const onPopState = () => setRoute(readRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => { applyTheme(theme) }, [theme])

  function toggleTheme() { setTheme((current) => current === 'light' ? 'dark' : 'light') }

  function navigate(next: Route) {
    const path = next.kind === 'landing' ? '/' : next.kind === 'projects' ? next.projectId ? `/projects/${next.projectId}/${next.projectSection === 'draft' ? 'draft' : 'intake'}` : '/projects' : next.section === 'intake' ? `/projects/${demoProjectId}` : `/projects/${demoProjectId}/${next.section}`
    window.history.pushState({}, '', path)
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return route.kind === 'landing'
    ? <LandingPage onEnter={() => navigate({ kind: 'projects' })} theme={theme} onToggleTheme={toggleTheme} />
    : route.kind === 'projects'
      ? <ProjectsPage projectId={route.projectId} projectSection={route.projectSection} onHome={() => navigate({ kind: 'landing' })} onProjects={() => navigate({ kind: 'projects' })} onOpenDemo={() => navigate({ kind: 'dashboard', section: 'intake' })} onOpenProject={(projectId, projectSection = 'intake') => navigate({ kind: 'projects', projectId, projectSection })} theme={theme} onToggleTheme={toggleTheme} />
      : <Dashboard section={route.section} onNavigate={(section) => navigate({ kind: 'dashboard', section })} onExit={() => navigate({ kind: 'landing' })} onProjects={() => navigate({ kind: 'projects' })} theme={theme} onToggleTheme={toggleTheme} />
}
