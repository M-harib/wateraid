import { useEffect, useState } from 'react'
import { Dashboard, type DashboardSection } from './Dashboard'
import { LandingPage } from './LandingPage'

type Route = { kind: 'landing' } | { kind: 'dashboard'; section: DashboardSection }

const sections: DashboardSection[] = ['overview', 'proposal', 'ask', 'issues', 'obligations', 'calendar', 'documents', 'reviews']

function readRoute(): Route {
  const [, root, section] = window.location.pathname.split('/')
  if (root !== 'dashboard') return { kind: 'landing' }
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
    const path = next.kind === 'landing' ? '/' : next.section === 'overview' ? '/dashboard' : `/dashboard/${next.section}`
    window.history.pushState({}, '', path)
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return route.kind === 'landing'
    ? <LandingPage onEnter={() => navigate({ kind: 'dashboard', section: 'overview' })} />
    : <Dashboard section={route.section} onNavigate={(section) => navigate({ kind: 'dashboard', section })} onExit={() => navigate({ kind: 'landing' })} />
}
