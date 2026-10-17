import { useEffect, useState } from 'react'
import { Dashboard, type DashboardSection } from './Dashboard'
import { LandingPage } from './LandingPage'
import { ProjectsPage } from './ProjectsPage'
import { demoProjectId } from './projects'

type Route = { kind: 'landing' } | { kind: 'projects'; projectId?: string } | { kind: 'dashboard'; section: DashboardSection }

const sections: DashboardSection[] = ['overview', 'issues', 'obligations', 'calendar', 'documents', 'reviews']

function readRoute(): Route {
  const [, root, section, projectSection] = window.location.pathname.split('/')
  if (root === 'projects' && section === demoProjectId) {
    if (projectSection === 'ask') return { kind: 'dashboard', section: 'documents' }
    return { kind: 'dashboard', section: sections.includes(projectSection as DashboardSection) ? projectSection as DashboardSection : 'overview' }
  }
  if (root === 'projects') return { kind: 'projects', projectId: section }
  if (root !== 'dashboard') return { kind: 'landing' }
  if (section === 'ask') return { kind: 'dashboard', section: 'documents' }
  return { kind: 'dashboard', section: sections.includes(section as DashboardSection) ? section as DashboardSection : 'overview' }
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const onPopState = () => setRoute(readRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(next: Route) {
    const path = next.kind === 'landing' ? '/' : next.kind === 'projects' ? next.projectId ? `/projects/${next.projectId}` : '/projects' : next.section === 'overview' ? `/projects/${demoProjectId}` : `/projects/${demoProjectId}/${next.section}`
    window.history.pushState({}, '', path)
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return route.kind === 'landing'
    ? <LandingPage onEnter={() => navigate({ kind: 'projects' })} />
    : route.kind === 'projects'
      ? <ProjectsPage projectId={route.projectId} onHome={() => navigate({ kind: 'landing' })} onProjects={() => navigate({ kind: 'projects' })} onOpenDemo={() => navigate({ kind: 'dashboard', section: 'overview' })} onOpenProject={(projectId) => navigate({ kind: 'projects', projectId })} />
      : <Dashboard section={route.section} onNavigate={(section) => navigate({ kind: 'dashboard', section })} onExit={() => navigate({ kind: 'landing' })} onProjects={() => navigate({ kind: 'projects' })} />
}
