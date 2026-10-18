import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpenText, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, FileQuestion, FileSpreadsheet, FileText, FolderOpen, LayoutDashboard, Menu, MessageSquareText, PanelLeftClose, PanelLeftOpen, Plus, Search, ShieldCheck, X } from 'lucide-react'
import { askProjectQuestion, askProposalQuestion, createProject, loadDashboard, loadProjectDocuments, loadProjects, loadProposalRunStatus, loadProposalWorkspace, projectDocumentFileUrl, runProposalChecks, type AskAnswer, type DashboardConnection, type ProjectDocument, type ProjectSummary, type ProposalRunStatus } from './api'
import { BrandMark } from './Brand'
import { ReviewDialog } from './components/ReviewDialog'
import { NewProjectDialog } from './components/NewProjectDialog'
import { AskPanel } from './components/AskPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { DraftWorkspace } from './components/DraftWorkspace'
import { ReportingCalendar } from './components/ReportingCalendar'
import { BackendDocuments } from './components/BackendDocuments'
import { PdfPreview } from './components/PdfPreview'
import { documentById, documents } from './documents'
import { evidenceLocation, type Finding, type ProposalWorkspace, type Requirement } from './domain'
import { investigations, type Investigation } from './investigations'
import { appendReview, evidenceFingerprint, latestReviewFor, loadReviews, type ReviewDecision, type ReviewRecord } from './reviews'
import type { Theme } from './theme'

export type DashboardSection = 'intake' | 'draft' | 'proposal' | 'overview' | 'issues' | 'obligations' | 'calendar' | 'documents' | 'reviews'
type Focus = { kind: 'finding'; id: string } | { kind: 'requirement'; id: string } | { kind: 'investigation'; id: string } | null
type Props = { section: DashboardSection; onNavigate: (section: DashboardSection) => void; onExit: () => void; onProjects: () => void; theme: Theme; onToggleTheme: () => void }

const nav: { section: DashboardSection; title: string; icon: typeof LayoutDashboard }[] = [
  { section: 'intake', title: 'Project documents', icon: FolderOpen },
  { section: 'draft', title: 'Proposal draft', icon: FileText },
  { section: 'proposal', title: 'Proposal review', icon: ClipboardCheck },
  { section: 'overview', title: 'Overview', icon: LayoutDashboard },
  { section: 'issues', title: 'Issues', icon: CircleAlert },
  { section: 'obligations', title: 'Obligations', icon: BookOpenText },
  { section: 'calendar', title: 'Reporting calendar', icon: CalendarDays },
  { section: 'documents', title: 'Evidence workspace', icon: FolderOpen },
  { section: 'reviews', title: 'Review history', icon: ShieldCheck },
]

function formatDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed)
}

function decisionLabel(decision: ReviewDecision) {
  return ({ confirmed: 'Confirmed', corrected: 'Corrected', dismissed: 'Dismissed', escalated: 'Escalated', clarification_requested: 'Clarification requested' })[decision]
}

function initialSidebarCollapsed() {
  try { return window.localStorage.getItem('grantguard.sidebar-collapsed.v1') === 'true' }
  catch { return false }
}

function SectionHeading({ eyebrow, title, subtitle, aside }: { eyebrow: string; title: string; subtitle: string; aside?: React.ReactNode }) {
  return <div className="dashboard-heading"><div><span className="dashboard-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{aside}</div>
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof FileQuestion; title: string; description: string; action?: React.ReactNode }) {
  return <div className="clean-empty"><span className="clean-empty-icon"><Icon size={25} /></span><h2>{title}</h2><p>{description}</p>{action}</div>
}

const proposalPrompts = [
  { id: 'Q5', question: "Does the agreement's minimum contribution meet the call's cost-share requirement?" },
  { id: 'Q21', question: 'Which proposed or reported construction activities may conflict with the call?' },
  { id: 'Q23', question: 'Which claims in the proposal and results report lack supporting evidence in those documents?' },
]

const emptyProposalWorkspace: ProposalWorkspace = { findings: [], checklist: [], reviewerQuestions: [], failures: [] }
const emptyProposalRun: ProposalRunStatus = { runId: null, status: 'idle', completed: 0, total: 5, percent: 0, steps: [], startedAt: null, finishedAt: null, error: null }

// Structured proposal answer (feat/proposal): confidence, supporting vs conflicting evidence, gaps, next action.
function AnswerPanel({ answer, openEvidence }: { answer: AskAnswer; openEvidence: (evidence: AskAnswer['evidence'][number]) => void }) {
  const supporting = answer.supportingEvidence.length ? answer.supportingEvidence : answer.status === 'conflict' ? [] : answer.evidence
  const conflicting = answer.conflictingEvidence.length ? answer.conflictingEvidence : answer.status === 'conflict' ? answer.evidence : []
  const evidenceGroup = (label: string, evidence: typeof answer.evidence, conflict = false) => evidence.length > 0 && <section className={`answer-evidence-group ${conflict ? 'conflicting' : ''}`}><h4>{label}</h4><div>{evidence.map((item, index) => <button type="button" key={`${item.documentId}-${index}-${label}`} onClick={() => openEvidence(item)}><span><strong>{documentById[item.documentId]?.shortTitle}</strong><small>{evidenceLocation({ ...item, id: `${index}`, version: null, verified: true })}</small></span><ArrowUpRight size={15} />{item.excerpt && <em>“{item.excerpt}”</em>}</button>)}</div></section>
  return <div className="answer-panel answer-detail">
    <div className="answer-heading"><span className="dashboard-eyebrow">{answer.status.replaceAll('_', ' ')} · REVIEW THE SOURCES</span><span className={`confidence-badge confidence-${answer.confidence.level}`}>{answer.confidence.level} evidence confidence</span></div>
    <section className="answer-direct"><h4>Direct answer</h4><p>{answer.answer}</p><small>{answer.confidence.reason}</small></section>
    {evidenceGroup('Supporting evidence', supporting)}
    {evidenceGroup('Conflicting evidence', conflicting, true)}
    {answer.missingInformation.length > 0 && <section className="answer-missing"><h4>Missing information</h4><ul>{answer.missingInformation.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
    <section className="answer-next"><span>SUGGESTED NEXT ACTION · RECOMMENDATION</span><p>{answer.suggestedNextAction}</p></section>
  </div>
}

function projectInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('') || 'P'
}

export function Dashboard({ section, onNavigate, onExit, onProjects, theme, onToggleTheme }: Props) {
  const [connection, setConnection] = useState<DashboardConnection>({ mode: 'preview', data: { projectName: 'Taps for Rights', asOf: '2022-06-30', findings: [], requirements: [] } })
  const [reviews, setReviews] = useState<ReviewRecord[]>(loadReviews)
  const [focus, setFocus] = useState<Focus>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('03')
  const [selectedPage, setSelectedPage] = useState<number | undefined>()
  const [reviewFinding, setReviewFinding] = useState<Finding | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [search, setSearch] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const [askError, setAskError] = useState('')
  const [asking, setAsking] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(() => window.location.pathname.endsWith('/ask'))
  const [notice, setNotice] = useState('')
  const [selectedExcerpt, setSelectedExcerpt] = useState<string | undefined>()
  const [uploadedDocs, setUploadedDocs] = useState<ProjectDocument[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectId, setProjectId] = useState(() => { try { return window.localStorage.getItem('grantguard.project') || 'taps-for-rights' } catch { return 'taps-for-rights' } })
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [proposal, setProposal] = useState<ProposalWorkspace>(emptyProposalWorkspace)
  const [proposalAvailable, setProposalAvailable] = useState(false)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [proposalQuestion, setProposalQuestion] = useState(proposalPrompts[0].question)
  const [proposalAnswer, setProposalAnswer] = useState<AskAnswer | null>(null)
  const [proposalAsking, setProposalAsking] = useState(false)
  const [proposalRun, setProposalRun] = useState<ProposalRunStatus>(emptyProposalRun)

  useEffect(() => {
    let active = true
    loadDashboard().then((result) => { if (active) setConnection(result) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (connection.mode !== 'connected') return
    let active = true
    Promise.all([loadProposalWorkspace(), loadProposalRunStatus()])
      .then(([result, run]) => { if (active) { setProposal(result); setProposalAvailable(true); setProposalRun(run); setProposalLoading(run.status === 'running') } })
      .catch((error) => { if (active) { setProposalAvailable(false); setProposalError(error instanceof Error ? error.message : 'Could not load proposal checks.') } })
    return () => { active = false }
  }, [connection.mode])

  // The review runs in the background (POST /proposal/run returns 202); poll its progress.
  useEffect(() => {
    if (proposalRun.status !== 'running' || connection.mode !== 'connected') return
    let active = true
    let timer: number | undefined
    const poll = async () => {
      try {
        const [run, workspace] = await Promise.all([loadProposalRunStatus(), loadProposalWorkspace()])
        if (!active) return
        setProposalRun(run)
        setProposal(workspace)
        if (run.status === 'running') timer = window.setTimeout(poll, 800)
        else if (run.status === 'completed') {
          setProposalLoading(false)
          setConnection(await loadDashboard())
          setNotice('Proposal review complete')
        } else if (run.status === 'failed') {
          setProposalLoading(false)
          setProposalError(run.error ?? 'The proposal review could not finish.')
        }
      } catch (error) {
        if (active) { setProposalLoading(false); setProposalError(error instanceof Error ? error.message : 'Could not read proposal progress.') }
      }
    }
    timer = window.setTimeout(poll, 300)
    return () => { active = false; if (timer) window.clearTimeout(timer) }
  }, [proposalRun.status, connection.mode])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  // available projects: populate the selector; keep the current selection if still present
  useEffect(() => {
    if (connection.mode !== 'connected') return
    let active = true
    loadProjects().then((list) => {
      if (!active) return
      setProjects(list)
      setProjectId((current) => (list.some((p) => p.projectId === current) ? current : list[0]?.projectId ?? current))
    }).catch(() => { /* leave selector as-is */ })
    return () => { active = false }
  }, [connection.mode])

  // uploaded documents for the selected project: searchable + previewable in the evidence workspace
  useEffect(() => {
    if (connection.mode !== 'connected') return
    let active = true
    setUploadedDocs([])
    const poll = async () => {
      try {
        const r = await loadProjectDocuments(projectId)
        if (!active) return
        setUploadedDocs(r.documents)
        if (r.documents.some((d) => d.status === 'queued' || d.status === 'ingesting')) window.setTimeout(poll, 1500)
      } catch { /* leave as-is */ }
    }
    void poll()
    return () => { active = false }
  }, [connection.mode, projectId])

  const findings = connection.data.findings
  const requirements = connection.data.requirements
  const readyUploads = useMemo(() => uploadedDocs.filter((d) => d.status === 'ready'), [uploadedDocs])
  const uploadedAsDocs = useMemo(() => readyUploads.map((d) => ({ id: d.doc_id, shortTitle: d.filename, title: d.filename, category: 'Uploaded', format: (d.kind === 'pdf' ? 'PDF' : 'XLSX') as 'PDF' | 'XLSX', url: projectDocumentFileUrl(projectId, d.doc_id) })), [readyUploads, projectId])
  // workspace lists only uploaded docs; docById also keeps bundled docs so finding citations still resolve in the preview
  const docById = useMemo(() => Object.fromEntries([...documents, ...uploadedAsDocs].map((d) => [d.id, d])) as Record<string, { id: string; shortTitle: string; title: string; category: string; format: 'PDF' | 'XLSX'; url: string }>, [uploadedAsDocs])
  const document = docById[selectedDocumentId] ?? uploadedAsDocs[0] ?? documents[0]
  const focusedFinding = focus?.kind === 'finding' ? [...findings, ...proposal.findings].find((item) => item.id === focus.id) : undefined
  const focusedRequirement = focus?.kind === 'requirement' ? requirements.find((item) => item.id === focus.id) : undefined
  const focusedInvestigation = focus?.kind === 'investigation' ? investigations.find((item) => item.id === focus.id) : undefined
  const focusedEvidence = focusedFinding?.evidence ?? focusedRequirement?.evidence ?? []
  const dates = useMemo(() => requirements.filter((item) => item.dueOn).sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? '')), [requirements])
  const currentReviewCount = findings.filter((item) => { const review = latestReviewFor(item.id, reviews); return review?.fingerprint === evidenceFingerprint(item) }).length
  const projectName = projects.find((p) => p.projectId === projectId)?.name ?? 'Taps for Rights'
  const filteredDocuments = uploadedAsDocs.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase()))
  const filteredFindings = findings.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(search.toLowerCase()))
  const filteredRequirements = requirements.filter((item) => `${item.title} ${item.statement}`.toLowerCase().includes(search.toLowerCase()))

  function navigate(next: DashboardSection) {
    setMobileNav(false)
    setSearch('')
    if (next === 'documents') setFocus(null)
    onNavigate(next)
  }

  function changeProject(id: string) {
    setProjectId(id)
    try { window.localStorage.setItem('grantguard.project', id) } catch { /* selection just won't persist */ }
    setSelectedDocumentId('')
    setSelectedPage(undefined)
    setSelectedExcerpt(undefined)
    setFocus(null)
    setAnswer(null)
  }

  async function submitNewProject(name: string) {
    const created = await createProject(name)
    setProjects((list) => (list.some((p) => p.projectId === created.projectId) ? list : [...list, created]))
    setNewProjectOpen(false)
    changeProject(created.projectId)
    navigate('intake')
  }

  function openAssistant() {
    setAssistantOpen(true)
    setFocus(null)
    onNavigate('documents')
  }

  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try { window.localStorage.setItem('grantguard.sidebar-collapsed.v1', String(next)) } catch { /* Layout choice remains for this session. */ }
  }

  function openSource(id: string, page?: number, excerpt?: string) {
    setSelectedExcerpt(excerpt)
    setSelectedDocumentId(id)
    setSelectedPage(page)
    setMobileNav(false)
    onNavigate('documents')
  }

  function openCitation(id: string, page?: number, excerpt?: string) {
    setFocus(null)
    openSource(id, page, excerpt)
    if (window.matchMedia('(max-width: 1100px)').matches) setAssistantOpen(false)
  }

  function openFinding(item: Finding) {
    setFocus({ kind: 'finding', id: item.id })
    openSource(item.evidence[0].documentId, item.evidence[0].locator.page, item.evidence[0].excerpt)
  }

  function openRequirement(item: Requirement) {
    setFocus({ kind: 'requirement', id: item.id })
    openSource(item.evidence[0].documentId, item.evidence[0].locator.page, item.evidence[0].excerpt)
  }

  function openInvestigation(item: Investigation) {
    setFocus({ kind: 'investigation', id: item.id })
    openSource(item.documentIds[0])
  }

  async function submitQuestion(event: React.FormEvent) {
    event.preventDefault()
    if (!question.trim() || asking) return
    setAnswer(null)
    setAskError('')
    if (connection.mode !== 'connected') { setAskError('The analysis service is not connected yet. You can inspect the source files below.'); return }
    setAsking(true)
    try { setAnswer(await askProjectQuestion(projectId, question.trim())) }
    catch (error) { setAskError(error instanceof Error ? error.message : 'The question service is unavailable.') }
    finally { setAsking(false) }
  }

  async function runProposalReview() {
    if (proposalLoading) return
    setProposalLoading(true)
    setProposalError('')
    try {
      const run = await runProposalChecks()
      setProposalRun(run)
      if (run.status === 'completed') {
        setProposal(await loadProposalWorkspace())
        setConnection(await loadDashboard())
        setProposalLoading(false)
        setNotice('Proposal review complete')
      } else if (run.status === 'failed') {
        setProposalLoading(false)
        setProposalError(run.error ?? 'The proposal review could not finish.')
      }
      // 'running': the polling effect takes over and clears proposalLoading when it finishes.
    } catch (error) {
      setProposalLoading(false)
      setProposalError(error instanceof Error ? error.message : 'The proposal review could not start.')
    }
  }

  async function submitProposalQuestion(event: React.FormEvent) {
    event.preventDefault()
    if (!proposalQuestion.trim() || proposalAsking) return
    setProposalAnswer(null)
    setProposalError('')
    if (connection.mode !== 'connected') { setProposalError('The analysis service is not connected.'); return }
    setProposalAsking(true)
    try {
      setProposalAnswer(await askProposalQuestion(proposalQuestion.trim()))
      setProposal(await loadProposalWorkspace())
      setConnection(await loadDashboard())
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : 'The proposal question could not be answered.')
    } finally {
      setProposalAsking(false)
    }
  }

  function saveReview(decision: ReviewDecision, note: string, correctedValue?: string) {
    if (!reviewFinding) return
    try {
      const record: ReviewRecord = { id: crypto.randomUUID(), findingId: reviewFinding.id, findingTitle: reviewFinding.title, fingerprint: evidenceFingerprint(reviewFinding), decision, note, ...(correctedValue ? { correctedValue } : {}), recordedAt: new Date().toISOString() }
      setReviews(appendReview(record))
      setReviewFinding(null)
      setNotice(`${decisionLabel(decision)} · saved in this browser`)
    } catch { setNotice('Could not save the decision in this browser.') }
  }

  return <div className={`dashboard-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
    {mobileNav && <button className="mobile-nav-cover" type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <aside className={`dashboard-sidebar ${mobileNav ? 'is-open' : ''}`}>
      <div className="sidebar-header"><button className="dashboard-brand" type="button" onClick={onExit} aria-label="GrantGuard home" title="GrantGuard home"><BrandMark /><span>GrantGuard</span></button><button type="button" className="sidebar-collapse-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
      <button type="button" className="sidebar-workspaces" onClick={onProjects} title="Workspaces"><FolderOpen size={19} /> <span>Workspaces</span></button>
      <div className="sidebar-case-wrap">
        <button className="sidebar-case" type="button" onClick={() => setProjectMenuOpen((open) => !open)} title="Switch project" aria-haspopup="menu" aria-expanded={projectMenuOpen}><span className="sidebar-case-monogram">{projectInitials(projectName)}</span><span><strong>{projectName}</strong><small>Switch project ▾</small></span></button>
        {projectMenuOpen && <>
          <button type="button" className="sidebar-case-cover" aria-label="Close project menu" onClick={() => setProjectMenuOpen(false)} />
          <div className="sidebar-case-menu" role="menu">
            <button type="button" className="sidebar-case-new" onClick={() => { setProjectMenuOpen(false); setNewProjectOpen(true) }}><Plus size={15} /> New project</button>
            {projects.map((item) => <button type="button" role="menuitemradio" aria-checked={item.projectId === projectId} key={item.projectId} className={`sidebar-case-item ${item.projectId === projectId ? 'active' : ''}`} onClick={() => { changeProject(item.projectId); setProjectMenuOpen(false) }}><span><strong>{item.name}</strong><small>{item.documentCount} document{item.documentCount === 1 ? '' : 's'}</small></span>{item.projectId === projectId && <Check size={15} />}</button>)}
          </div>
        </>}
      </div>
      <span className="sidebar-caption">WORKSPACE</span>
      <nav aria-label="Dashboard navigation">{nav.map(({ section: target, title, icon: Icon }) => <button type="button" key={target} className={`dashboard-nav-item ${section === target ? 'active' : ''}`} onClick={() => navigate(target)} aria-label={title} title={title} aria-current={section === target ? 'page' : undefined}><Icon size={18} /><span>{title}</span>{target === 'issues' && findings.length > 0 && <em>{findings.length}</em>}{target === 'proposal' && proposal.checklist.length > 0 && <em>{proposal.checklist.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><span className="sidebar-divider" /><span className="sidebar-caption">CASE VIEW</span><p>Historical scenario<br /><strong>{formatDate(connection.data.asOf)}</strong></p></div>
    </aside>

    <div className="dashboard-body">
      <header className="dashboard-topbar"><button className="dashboard-mobile-menu" type="button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button><span className="dashboard-crumb">Workspace <ChevronRight size={15} /> <strong>{nav.find((item) => item.section === section)?.title}</strong></span><div className="dashboard-topbar-actions"><span className={`service-state ${connection.mode === 'connected' ? 'connected' : ''}`}><i /> {connection.mode === 'connected' ? 'Analysis connected' : connection.mode === 'unavailable' ? 'Service unavailable' : 'Source pack preview'}</span><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div></header>

      <main className={`dashboard-main dashboard-${section}`}>
        {section === 'intake' && <BackendDocuments projectId={projectId} projectName={projectName} connected={connection.mode === 'connected'} />}
        {section === 'draft' && <DraftWorkspace projectId="taps-for-rights" projectName="Taps for Rights" findings={findings} requirements={requirements} analysisConnected={connection.mode === 'connected'} proposal={proposalAvailable ? proposal : null} proposalBusy={proposalLoading} proposalError={proposalError} onRunProposal={runProposalReview} onOpenIssue={openFinding} onOpenRequirement={openRequirement} onOpenSource={openCitation} onOpenIntake={() => navigate('intake')} />}

        {section === 'proposal' && <>
          <SectionHeading eyebrow="PRE-SUBMISSION REVIEW / PROPOSAL" title="Check the proposal against the call." subtitle="Ask any proposal question, or run the structured review and inspect every cited source." aside={<span className="heading-count">{proposal.checklist.length} checks</span>} />
          <div className="proposal-run-card"><div><span className="dashboard-eyebrow">PROPOSAL ASSISTANT</span><h2>{proposalLoading ? `Review ${proposalRun.percent}% complete.` : proposal.checklist.length ? 'Review results are ready.' : 'Run the source-backed review.'}</h2><p>The backend reads files 01–06, verifies quoted evidence, and uses code for cost-share and construction comparisons. You can keep using the dashboard while the review runs.</p>{proposalLoading && <div className="proposal-progress"><div><span>{proposalRun.completed} of {proposalRun.total} review steps finished</span><strong>{proposalRun.percent}%</strong></div><div className="proposal-progress-track" role="progressbar" aria-label="Proposal review progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={proposalRun.percent}><span style={{ width: `${proposalRun.percent}%` }} /></div><ul>{proposalRun.steps.map((step) => <li key={step.id} className={`step-${step.status}`}><span />{step.label}<small>{step.status}</small></li>)}</ul></div>}</div><button className="solid-button" type="button" onClick={runProposalReview} disabled={proposalLoading || connection.mode !== 'connected'}>{proposalLoading ? 'Review running' : proposal.checklist.length ? 'Run again' : 'Run proposal checks'} <ArrowRight size={16} /></button></div>
          {connection.mode !== 'connected' && <div className="clean-banner"><CircleAlert size={20} /><div><strong>Analysis service not connected</strong><p>Set VITE_API_BASE_URL in frontend/.env.local and start the API to run proposal checks.</p></div></div>}
          <div className="proposal-prompts"><span className="dashboard-eyebrow">SAMPLE QUESTIONS</span>{proposalPrompts.map((item) => <button type="button" key={item.id} className={proposalQuestion === item.question ? 'active' : ''} onClick={() => { setProposalQuestion(item.question); setProposalAnswer(null); setProposalError('') }}><span>{item.id}</span><strong>{item.question}</strong></button>)}</div>
          <form className="ask-composer proposal-composer" onSubmit={submitProposalQuestion}><label htmlFor="proposal-question">Ask anything about the proposal</label><textarea id="proposal-question" value={proposalQuestion} onChange={(event) => setProposalQuestion(event.target.value)} placeholder="Where will the project operate, and what activities are proposed there?" rows={3} /><p className="proposal-scope-note">Automatically searches the call, proposal, agreement, report, PMF, and reviewer questions. <button type="button" onClick={() => { setQuestion(proposalQuestion); setAnswer(null); setAskError(''); setAssistantOpen(true); navigate('documents') }}>Use the evidence workspace assistant for questions outside the proposal review.</button></p><div><span>Every answer must include an exact, verified excerpt from the proposal sources.</span><button className="solid-button" type="submit" disabled={!proposalQuestion.trim() || proposalAsking || connection.mode !== 'connected'}>{proposalAsking ? 'Checking sources…' : 'Ask proposal'} <ArrowRight size={16} /></button></div></form>
          {proposalError && <div className="inline-error" role="alert">{proposalError}</div>}
          {proposal.failures.map((failure, index) => <div className="clean-banner proposal-failure" key={`${failure}-${index}`}><CircleAlert size={20} /><div><strong>One check needs another run</strong><p>{failure}</p></div></div>)}
          {proposalAnswer && <AnswerPanel answer={proposalAnswer} openEvidence={(item) => openCitation(item.documentId, item.locator.page, item.excerpt)} />}
          {proposal.findings.length > 0 && <section className="proposal-section"><div className="proposal-section-head"><div><span className="dashboard-eyebrow">PRIORITY FINDINGS</span><h2>What needs human review</h2></div><span>{proposal.findings.length} findings</span></div><div className="clean-list">{proposal.findings.map((item) => <button type="button" key={item.id} onClick={() => openFinding(item)}><span className="list-icon"><CircleAlert size={19} /></span><span className="list-copy"><small>{item.kind.replaceAll('_', ' ')} · {item.evidence.length} cited source{item.evidence.length === 1 ? '' : 's'}</small><strong>{item.title}</strong><span>{item.summary}</span></span><span className="row-status">{item.priority}</span><ChevronRight size={18} /></button>)}</div></section>}
          <section className="proposal-section"><div className="proposal-section-head"><div><span className="dashboard-eyebrow">CALL REQUIREMENTS</span><h2>Checklist against proposal 02</h2></div>{proposal.checklist.length > 0 && <span>{proposal.checklist.filter((row) => row.status === 'met').length} met</span>}</div>{proposal.checklist.length ? <div className="proposal-checklist">{proposal.checklist.map((row) => <article key={row.id}><div><span className={`proposal-status status-${row.status}`}>{row.status.replaceAll('_', ' ')}</span><small>{row.category.replaceAll('_', ' ')}</small></div><h3>{row.requirement}</h3><p>{row.reason}</p>{row.absentSources.length > 0 && <small className="proposal-absent">Not in pack: {row.absentSources.join(', ')}</small>}<div className="proposal-evidence">{row.evidence.map((item, index) => <button type="button" key={`${item.id}-${index}`} onClick={() => openCitation(item.documentId, item.locator.page, item.excerpt)}><strong>{item.documentId}</strong><span>{evidenceLocation(item)}</span><ArrowUpRight size={14} /></button>)}</div></article>)}</div> : <EmptyState icon={ClipboardCheck} title="No proposal checks run yet" description="Start the review to compare the nine call-requirement categories with the preliminary proposal." />}</section>
          {proposal.reviewerQuestions.length > 0 && <section className="proposal-section"><div className="proposal-section-head"><div><span className="dashboard-eyebrow">GAC REVIEW PREP</span><h2>Reviewer questions mapped</h2></div><span>{proposal.reviewerQuestions.length} questions</span></div><div className="reviewer-map">{proposal.reviewerQuestions.map((row, index) => <article key={`${row.question.id}-${index}`}><span className={`proposal-status status-${row.status}`}>{row.status.replaceAll('_', ' ')}</span><p>“{row.question.excerpt}”</p><small>{row.reason}</small><div className="proposal-evidence"><button type="button" onClick={() => openCitation(row.question.documentId, row.question.locator.page, row.question.excerpt)}><strong>06</strong><span>{evidenceLocation(row.question)}</span><ArrowUpRight size={14} /></button>{row.proposal.map((item, proposalIndex) => <button type="button" key={`${item.id}-${proposalIndex}`} onClick={() => openCitation(item.documentId, item.locator.page, item.excerpt)}><strong>02</strong><span>{evidenceLocation(item)}</span><ArrowUpRight size={14} /></button>)}</div></article>)}</div></section>}
        </>}
        {section === 'overview' && <>
          <SectionHeading eyebrow="CASE OVERVIEW / 30 JUNE 2022" title="What needs attention?" subtitle="One place to ask, inspect, and decide—grounded in the original grant documents." />
          <div className="overview-feature"><div><span className="overview-feature-kicker"><MessageSquareText size={16} /> START HERE</span><h2>Ask while you<br />read the source.</h2><p>Trace the answer to its source, or see where the evidence is missing.</p><button className="solid-button" type="button" onClick={openAssistant}>Open evidence workspace <ArrowRight size={17} /></button></div><div className="overview-feature-art" aria-hidden="true"><div><span>QUESTION</span><strong>When is the final report due?</strong></div><div><span>SOURCE</span><strong>Agreement · cited page</strong></div><div><span>REVIEW</span><strong>Human decision required</strong></div></div></div>
          <div className="overview-stats"><div><span>Source files</span><strong>{String(documents.length).padStart(2, '0')}</strong><small>Original pack available</small></div><div><span>Issues to review</span><strong>{String(findings.length).padStart(2, '0')}</strong><small>{findings.length ? 'From the shared finding store' : 'No findings loaded yet'}</small></div><div><span>Current reviews</span><strong>{String(currentReviewCount).padStart(2, '0')}</strong><small>Matched to current findings</small></div></div>
          {connection.mode !== 'connected' && <div className="clean-banner"><FileQuestion size={20} /><div><strong>{connection.mode === 'unavailable' ? 'Analysis service unavailable' : 'Source pack preview'}</strong><p>{connection.mode === 'unavailable' ? connection.message : 'The documents are ready to inspect. Answers and findings will appear when the team’s analysis service is connected.'}</p></div></div>}
          <div className="overview-links"><button type="button" onClick={() => navigate('proposal')}><ClipboardCheck size={20} /><span><strong>Check the proposal</strong><small>Call checklist and Q5, Q21, Q23</small></span><ArrowUpRight size={17} /></button><button type="button" onClick={() => navigate('issues')}><CircleAlert size={20} /><span><strong>Review issues</strong><small>Findings and guide questions</small></span><ArrowUpRight size={17} /></button><button type="button" onClick={() => navigate('documents')}><FolderOpen size={20} /><span><strong>Open evidence workspace</strong><small>Seven original files and AI panel</small></span><ArrowUpRight size={17} /></button></div>
        </>}

        {section === 'issues' && <>
          <SectionHeading eyebrow="FINDINGS / HUMAN REVIEW" title="Issues to review." subtitle="Every issue should explain the concern and preserve its source trail." aside={<span className="heading-count">{findings.length} findings</span>} />
          {findings.length ? <><label className="dashboard-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search issues" /></label><div className="clean-list">{filteredFindings.map((item) => { const review = latestReviewFor(item.id, reviews); const current = review?.fingerprint === evidenceFingerprint(item); return <button type="button" key={item.id} onClick={() => openFinding(item)}><span className="list-icon"><CircleAlert size={19} /></span><span className="list-copy"><small>{item.kind.replaceAll('_', ' ')} · {item.evidence.length} cited source{item.evidence.length === 1 ? '' : 's'}</small><strong>{item.title}</strong><span>{item.summary}</span></span><span className="row-status">{current ? decisionLabel(review.decision) : review ? 'Review stale' : item.state.replaceAll('_', ' ')}</span><ChevronRight size={18} /></button> })}{filteredFindings.length === 0 && <p className="no-results">No matching issues.</p>}</div></> : <><EmptyState icon={CircleAlert} title="No findings loaded yet" description="The shared finding store has not returned reviewable issues. The source pack is available while the backend work continues." action={<button className="outline-button" type="button" onClick={() => navigate('documents')}>Browse the source pack <ArrowRight size={16} /></button>} /><div className="guide-list"><span className="dashboard-eyebrow">GUIDE QUESTIONS · NOT FINDINGS</span>{investigations.map((item) => <button type="button" key={item.id} onClick={() => openInvestigation(item)}><span>{String(item.questionNumber).padStart(2, '0')}</span><strong>{item.title}</strong><small>{item.description}</small><ChevronRight size={17} /></button>)}</div></>}
        </>}

        {section === 'obligations' && <>
          <SectionHeading eyebrow="REQUIREMENTS REGISTER" title="Obligations." subtitle="A concise register of extracted requirements, each linked to its source." aside={<span className="heading-count">{requirements.length} extracted</span>} />
          {requirements.length ? <><label className="dashboard-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search obligations" /></label><div className="clean-list">{filteredRequirements.map((item) => <button type="button" key={item.id} onClick={() => openRequirement(item)}><span className="list-icon"><BookOpenText size={19} /></span><span className="list-copy"><small>{item.category} · {item.status.replaceAll('_', ' ')}</small><strong>{item.title}</strong><span>{item.statement}</span></span><span className="row-status">{item.dueOn ? formatDate(item.dueOn) : 'No date'}</span><ChevronRight size={18} /></button>)}{filteredRequirements.length === 0 && <p className="no-results">No matching obligations.</p>}</div></> : <EmptyState icon={BookOpenText} title="No obligations extracted yet" description="When the analysis service returns cited obligations, they will appear here with their original source references." action={<button className="outline-button" type="button" onClick={() => navigate('documents')}>Inspect source files <ArrowRight size={16} /></button>} />}
        </>}

        {section === 'calendar' && <>
          <SectionHeading eyebrow="REPORTING CALENDAR" title="Dates from the sources." subtitle={dates.length ? 'Dates appear here only when attached to a cited obligation. Conflicting dates stay in the issues view.' : 'Pick a date to see which reports fall due. Sample schedule from the agreement until the backend returns cited obligations.'} aside={<span className="heading-count">{dates.length ? `${dates.length} sourced dates` : 'Sample schedule'}</span>} />
          {dates.length ? <div className="calendar-list">{dates.map((item) => <button type="button" key={item.id} onClick={() => openRequirement(item)}><span className="calendar-date">{formatDate(item.dueOn!)}</span><span><strong>{item.title}</strong><small>{item.category} · {item.evidence.length} source{item.evidence.length === 1 ? '' : 's'}</small></span><ChevronRight size={17} /></button>)}</div> : <ReportingCalendar asOf={connection.data.asOf} onOpenSource={openCitation} />}
        </>}

        {section === 'documents' && <>
          <SectionHeading eyebrow="EVIDENCE WORKSPACE / UPLOADED DOCUMENTS" title="Read, ask, and review." subtitle="Open one of your uploaded sources in the center. Ask questions alongside it and follow citations back to the original." />
          <div className="workspace-toolbar"><div className="workspace-scope"><span className="dashboard-eyebrow">PROJECT</span><strong>{projectName}</strong></div><button type="button" className={`workspace-assistant-toggle ${assistantOpen ? 'active' : ''}`} onClick={() => setAssistantOpen(!assistantOpen)} aria-expanded={assistantOpen}><MessageSquareText size={17} /> {assistantOpen ? 'Close assistant' : 'Ask the documents'}</button></div>
          {assistantOpen && <button className="assistant-mobile-cover" type="button" onClick={() => setAssistantOpen(false)} aria-label="Close assistant" />}
          <div className={`source-workspace ${assistantOpen ? 'with-assistant' : ''}`}>
            <div className="source-rail"><span className="source-rail-label">SOURCE FILES</span><label className="source-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a document" aria-label="Find a document" /></label>{filteredDocuments.map((item) => { const Icon = item.format === 'PDF' ? FileText : FileSpreadsheet; return <button type="button" key={item.id} className={`source-rail-item ${document.id === item.id ? 'active' : ''}`} onClick={() => { setSelectedDocumentId(item.id); setSelectedPage(undefined); setSelectedExcerpt(undefined); if (!focusedEvidence.some((evidence) => evidence.documentId === item.id) && !focusedInvestigation?.documentIds.includes(item.id)) setFocus(null) }}><span className="source-rail-icon"><Icon size={17} /></span><span><strong>{item.shortTitle}</strong><small>{item.id} · {item.format}</small></span></button> })}{filteredDocuments.length === 0 && <p className="no-results">No documents found.</p>}</div>
            <div className="source-center">
              {(focusedFinding || focusedRequirement || focusedInvestigation) && <div className="source-context"><span className="dashboard-eyebrow">{focusedFinding ? 'ISSUE UNDER REVIEW' : focusedRequirement ? 'EXTRACTED OBLIGATION' : `GUIDE QUESTION ${focusedInvestigation?.questionNumber}`}</span><h2>{focusedFinding?.title ?? focusedRequirement?.title ?? focusedInvestigation?.title}</h2><p>{focusedFinding?.summary ?? focusedRequirement?.statement ?? focusedInvestigation?.question}</p>{focusedFinding?.resolver && <p className="source-resolver"><strong>Who decides:</strong> {focusedFinding.resolver === 'gac' ? 'GAC' : focusedFinding.resolver === 'water_care_staff' ? 'Water Care staff' : focusedFinding.resolver}</p>}{focusedFinding && <button type="button" className="outline-button" onClick={() => setReviewFinding(focusedFinding)}>Record human review <ArrowRight size={16} /></button>}{focusedInvestigation && <small className="context-caveat">Investigation prompt from file 00; no finding has been generated.</small>}{focusedEvidence.length > 0 && <div className="source-evidence">{focusedEvidence.map((item, index) => <button type="button" key={`${item.id}-${index}`} className={document.id === item.documentId ? 'active' : ''} onClick={() => openSource(item.documentId, item.locator.page, item.excerpt)}><span><strong>{docById[item.documentId]?.shortTitle ?? item.documentId}</strong><small>{evidenceLocation(item)} · {item.verified ? 'Quote verified' : 'Needs verification'} · version {item.version ?? 'unknown'}</small></span><ChevronRight size={16} />{item.excerpt && <em>“{item.excerpt}”</em>}</button>)}</div>}</div>}
              <div className="source-document-head"><span><small>DOCUMENT {document.id} / {document.category.toUpperCase()}</small><strong>{document.title}</strong></span><a href={document.url} target="_blank" rel="noreferrer">{document.format === 'PDF' ? 'Open original' : 'Download workbook'} <ArrowUpRight size={16} /></a></div>
              {document.format === 'PDF' ? <PdfPreview title={document.title} url={document.url} page={selectedPage} highlight={selectedExcerpt} /> : <div className="workbook-panel"><FileSpreadsheet size={34} /><h3>Workbook source</h3><p>Open the original spreadsheet to inspect its sheet and cell values. Any cited sheet and range appear in the evidence above.</p><a className="solid-button" href={document.url} download>Download workbook <ArrowUpRight size={16} /></a></div>}
            </div>
            {assistantOpen && <AskPanel question={question} onQuestion={(value) => { setQuestion(value); setAnswer(null); setAskError('') }} onSubmit={submitQuestion} answer={answer} error={askError} asking={asking} connected={connection.mode === 'connected'} onClose={() => setAssistantOpen(false)} onCitation={openCitation} resolveName={(id) => docById[id]?.shortTitle} scope="Your uploaded documents" showGuide={false} />}
          </div>
        </>}

        {section === 'reviews' && <>
          <SectionHeading eyebrow="HUMAN DECISIONS" title="Review history." subtitle="Staff decisions are kept separate from generated findings and checked against the current source trail." aside={<span className="heading-count">{reviews.length} recorded</span>} />
          {reviews.length ? <div className="review-history">{[...reviews].reverse().map((record) => { const match = findings.find((item) => item.id === record.findingId); const stale = !match || record.fingerprint !== evidenceFingerprint(match); return <article key={record.id}><span className="list-icon"><ClipboardCheck size={18} /></span><div><div><strong>{record.findingTitle}</strong><span className={`review-badge ${stale ? 'stale' : ''}`}>{!match ? 'Finding unavailable' : stale ? 'Finding changed' : decisionLabel(record.decision)}</span></div><p>{record.note || record.correctedValue || 'No note added.'}</p><small>{new Date(record.recordedAt).toLocaleString()} · Stored in this browser</small></div></article> })}</div> : <EmptyState icon={ClipboardCheck} title="No decisions recorded yet" description="Open a cited finding to confirm, correct, dismiss, escalate, or request clarification. Your decision will appear here." />}
        </>}
      </main>
    </div>
    {reviewFinding && <ReviewDialog finding={reviewFinding} onClose={() => setReviewFinding(null)} onSave={saveReview} />}
    {newProjectOpen && <NewProjectDialog onClose={() => setNewProjectOpen(false)} onCreate={submitNewProject} />}
    {notice && <div className="dashboard-toast" role="status"><CheckCircle2 size={17} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={16} /></button></div>}
  </div>
}
