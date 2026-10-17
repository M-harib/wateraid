import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpenText, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, FileQuestion, FileSpreadsheet, FileText, FolderOpen, LayoutDashboard, Menu, MessageSquareText, Search, ShieldCheck, X } from 'lucide-react'
import { askProposalQuestion, askQuestion, loadDashboard, loadProposalWorkspace, runProposalChecks, type AskAnswer, type DashboardConnection } from './api'
import { BrandMark } from './Brand'
import { ReviewDialog } from './components/ReviewDialog'
import { documentById, documents } from './documents'
import { evidenceLocation, type Finding, type ProposalWorkspace, type Requirement } from './domain'
import { investigations, type Investigation } from './investigations'
import { appendReview, evidenceFingerprint, latestReviewFor, loadReviews, type ReviewDecision, type ReviewRecord } from './reviews'

const PdfPreview = lazy(() => import('./components/PdfPreview').then((module) => ({ default: module.PdfPreview })))

export type DashboardSection = 'overview' | 'proposal' | 'ask' | 'issues' | 'obligations' | 'calendar' | 'documents' | 'reviews'
type Focus = { kind: 'finding'; id: string } | { kind: 'requirement'; id: string } | { kind: 'investigation'; id: string } | null
type Props = { section: DashboardSection; onNavigate: (section: DashboardSection) => void; onExit: () => void }

const nav: { section: DashboardSection; title: string; icon: typeof LayoutDashboard }[] = [
  { section: 'overview', title: 'Overview', icon: LayoutDashboard },
  { section: 'proposal', title: 'Proposal review', icon: ClipboardCheck },
  { section: 'ask', title: 'Ask the documents', icon: MessageSquareText },
  { section: 'issues', title: 'Issues', icon: CircleAlert },
  { section: 'obligations', title: 'Obligations', icon: BookOpenText },
  { section: 'calendar', title: 'Reporting calendar', icon: CalendarDays },
  { section: 'documents', title: 'Source library', icon: FolderOpen },
  { section: 'reviews', title: 'Review history', icon: ShieldCheck },
]

const proposalPrompts = [
  { id: 'Q5', question: "Does the agreement's minimum contribution meet the call's cost-share requirement?" },
  { id: 'Q21', question: 'Which proposed or reported construction activities may conflict with the call?' },
  { id: 'Q23', question: 'Which claims in the proposal and results report lack supporting evidence in those documents?' },
]

const emptyProposalWorkspace: ProposalWorkspace = { findings: [], checklist: [], reviewerQuestions: [], failures: [] }

function formatDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed)
}

function decisionLabel(decision: ReviewDecision) {
  return ({ confirmed: 'Confirmed', corrected: 'Corrected', dismissed: 'Dismissed', escalated: 'Escalated', clarification_requested: 'Clarification requested' })[decision]
}

function SectionHeading({ eyebrow, title, subtitle, aside }: { eyebrow: string; title: string; subtitle: string; aside?: React.ReactNode }) {
  return <div className="dashboard-heading"><div><span className="dashboard-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{aside}</div>
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof FileQuestion; title: string; description: string; action?: React.ReactNode }) {
  return <div className="clean-empty"><span className="clean-empty-icon"><Icon size={25} /></span><h2>{title}</h2><p>{description}</p>{action}</div>
}

export function Dashboard({ section, onNavigate, onExit }: Props) {
  const [connection, setConnection] = useState<DashboardConnection>({ mode: 'preview', data: { projectName: 'Taps for Rights', asOf: '2022-06-30', findings: [], requirements: [] } })
  const [reviews, setReviews] = useState<ReviewRecord[]>(loadReviews)
  const [focus, setFocus] = useState<Focus>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('03')
  const [selectedPage, setSelectedPage] = useState<number | undefined>()
  const [reviewFinding, setReviewFinding] = useState<Finding | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const [askError, setAskError] = useState('')
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState('')
  const [proposal, setProposal] = useState<ProposalWorkspace>(emptyProposalWorkspace)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [proposalQuestion, setProposalQuestion] = useState(proposalPrompts[0].question)
  const [proposalAnswer, setProposalAnswer] = useState<AskAnswer | null>(null)
  const [proposalAsking, setProposalAsking] = useState(false)

  useEffect(() => {
    let active = true
    loadDashboard().then((result) => { if (active) setConnection(result) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (connection.mode !== 'connected') return
    let active = true
    loadProposalWorkspace()
      .then((result) => { if (active) setProposal(result) })
      .catch((error) => { if (active) setProposalError(error instanceof Error ? error.message : 'Could not load proposal checks.') })
    return () => { active = false }
  }, [connection.mode])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const findings = connection.data.findings
  const requirements = connection.data.requirements
  const document = documentById[selectedDocumentId] ?? documents[0]
  const focusedFinding = focus?.kind === 'finding' ? findings.find((item) => item.id === focus.id) : undefined
  const focusedRequirement = focus?.kind === 'requirement' ? requirements.find((item) => item.id === focus.id) : undefined
  const focusedInvestigation = focus?.kind === 'investigation' ? investigations.find((item) => item.id === focus.id) : undefined
  const focusedEvidence = focusedFinding?.evidence ?? focusedRequirement?.evidence ?? []
  const dates = useMemo(() => requirements.filter((item) => item.dueOn).sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? '')), [requirements])
  const currentReviewCount = findings.filter((item) => { const review = latestReviewFor(item.id, reviews); return review?.fingerprint === evidenceFingerprint(item) }).length
  const filteredDocuments = documents.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase()))
  const filteredFindings = findings.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(search.toLowerCase()))
  const filteredRequirements = requirements.filter((item) => `${item.title} ${item.statement}`.toLowerCase().includes(search.toLowerCase()))

  function navigate(next: DashboardSection) {
    setMobileNav(false)
    setSearch('')
    if (next === 'documents') setFocus(null)
    onNavigate(next)
  }

  function openSource(id: string, page?: number) {
    setSelectedDocumentId(id)
    setSelectedPage(page)
    setMobileNav(false)
    onNavigate('documents')
  }

  function openFinding(item: Finding) {
    setFocus({ kind: 'finding', id: item.id })
    openSource(item.evidence[0].documentId, item.evidence[0].locator.page)
  }

  function openRequirement(item: Requirement) {
    setFocus({ kind: 'requirement', id: item.id })
    openSource(item.evidence[0].documentId, item.evidence[0].locator.page)
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
    try { setAnswer(await askQuestion(question.trim())) }
    catch (error) { setAskError(error instanceof Error ? error.message : 'The question service is unavailable.') }
    finally { setAsking(false) }
  }

  async function runProposalReview() {
    if (proposalLoading) return
    setProposalLoading(true)
    setProposalError('')
    try {
      const result = await runProposalChecks()
      setProposal(result)
      setConnection(await loadDashboard())
      setNotice('Proposal review complete')
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : 'The proposal review could not finish.')
    } finally {
      setProposalLoading(false)
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

  return <div className="dashboard-shell">
    {mobileNav && <button className="mobile-nav-cover" type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <aside className={`dashboard-sidebar ${mobileNav ? 'is-open' : ''}`}>
      <button className="dashboard-brand" type="button" onClick={onExit}><BrandMark /><span>GrantGuard</span></button>
      <div className="sidebar-case"><span className="sidebar-case-monogram">WC</span><span><strong>Water Care</strong><small>Taps for Rights</small></span></div>
      <span className="sidebar-caption">WORKSPACE</span>
      <nav aria-label="Dashboard navigation">{nav.map(({ section: target, title, icon: Icon }) => <button type="button" key={target} className={`dashboard-nav-item ${section === target ? 'active' : ''}`} onClick={() => navigate(target)} aria-current={section === target ? 'page' : undefined}><Icon size={18} /><span>{title}</span>{target === 'proposal' && proposal.checklist.length > 0 && <em>{proposal.checklist.length}</em>}{target === 'issues' && findings.length > 0 && <em>{findings.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><span className="sidebar-divider" /><span className="sidebar-caption">CASE VIEW</span><p>Historical scenario<br /><strong>{formatDate(connection.data.asOf)}</strong></p><button type="button" onClick={onExit}><ArrowLeft size={16} /> Back to site</button></div>
    </aside>

    <div className="dashboard-body">
      <header className="dashboard-topbar"><button className="dashboard-mobile-menu" type="button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button><span className="dashboard-crumb">Workspace <ChevronRight size={15} /> <strong>{nav.find((item) => item.section === section)?.title}</strong></span><span className={`service-state ${connection.mode === 'connected' ? 'connected' : ''}`}><i /> {connection.mode === 'connected' ? 'Analysis connected' : connection.mode === 'unavailable' ? 'Service unavailable' : 'Source pack preview'}</span></header>

      <main className={`dashboard-main dashboard-${section}`}>
        {section === 'overview' && <>
          <SectionHeading eyebrow="CASE OVERVIEW / 30 JUNE 2022" title="What needs attention?" subtitle="One place to ask, inspect, and decide—grounded in the original grant documents." />
          <div className="overview-feature"><div><span className="overview-feature-kicker"><MessageSquareText size={16} /> START HERE</span><h2>Ask the documents<br />a question.</h2><p>Trace the answer to its source, or see where the evidence is missing.</p><button className="solid-button" type="button" onClick={() => navigate('ask')}>Open Q&A <ArrowRight size={17} /></button></div><div className="overview-feature-art" aria-hidden="true"><div><span>QUESTION</span><strong>When is the final report due?</strong></div><div><span>SOURCE</span><strong>Agreement · cited page</strong></div><div><span>REVIEW</span><strong>Human decision required</strong></div></div></div>
          <div className="overview-stats"><div><span>Source files</span><strong>{String(documents.length).padStart(2, '0')}</strong><small>Original pack available</small></div><div><span>Issues to review</span><strong>{String(findings.length).padStart(2, '0')}</strong><small>{findings.length ? 'From the shared finding store' : 'No findings loaded yet'}</small></div><div><span>Current reviews</span><strong>{String(currentReviewCount).padStart(2, '0')}</strong><small>Matched to current findings</small></div></div>
          {connection.mode !== 'connected' && <div className="clean-banner"><FileQuestion size={20} /><div><strong>{connection.mode === 'unavailable' ? 'Analysis service unavailable' : 'Source pack preview'}</strong><p>{connection.mode === 'unavailable' ? connection.message : 'The documents are ready to inspect. Answers and findings will appear when the team’s analysis service is connected.'}</p></div></div>}
          <div className="overview-links"><button type="button" onClick={() => navigate('proposal')}><ClipboardCheck size={20} /><span><strong>Check the proposal</strong><small>Call checklist and Q5, Q21, Q23</small></span><ArrowUpRight size={17} /></button><button type="button" onClick={() => navigate('issues')}><CircleAlert size={20} /><span><strong>Review issues</strong><small>Findings and guide questions</small></span><ArrowUpRight size={17} /></button><button type="button" onClick={() => navigate('documents')}><FolderOpen size={20} /><span><strong>Open source library</strong><small>Seven original files</small></span><ArrowUpRight size={17} /></button></div>
        </>}

        {section === 'ask' && <>
          <SectionHeading eyebrow="Q&A / SHARED CORE" title="Ask the documents." subtitle="A question is answered only when the analysis service supplies a supported response." />
          <form className="ask-composer" onSubmit={submitQuestion}><label htmlFor="question-input">Your question</label><textarea id="question-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What does the agreement require for the final report?" rows={4} /><div><span>{connection.mode === 'connected' ? 'Responses are checked against the source pack.' : 'Connect the analysis service to receive an answer.'}</span><button className="solid-button" type="submit" disabled={!question.trim() || asking}>{asking ? 'Checking sources…' : 'Ask question'} <ArrowRight size={16} /></button></div></form>
          {askError && <div className="inline-error" role="alert">{askError}</div>}
          {answer && <div className="answer-panel"><span className="dashboard-eyebrow">{answer.status?.replaceAll('_', ' ') ?? 'RESPONSE'} · REVIEW THE SOURCES</span><p>{answer.answer}</p>{answer.evidence.length ? <div className="answer-sources">{answer.evidence.map((item, index) => <button type="button" key={`${item.documentId}-${index}`} onClick={() => { setFocus(null); openSource(item.documentId, item.locator.page) }}>{documentById[item.documentId]?.shortTitle} · {evidenceLocation({ ...item, id: `${index}`, version: null, verified: false })}<ArrowUpRight size={15} /></button>)}</div> : <small>No source references were returned. Treat this as unverified.</small>}</div>}
          <div className="ask-prompts"><span className="dashboard-eyebrow">FROM THE CHALLENGE GUIDE</span><h2>Questions to explore</h2><div>{investigations.map((item) => <button type="button" key={item.id} onClick={() => { setQuestion(item.question); setAnswer(null); setAskError('') }}><span>{String(item.questionNumber).padStart(2, '0')}</span><strong>{item.question}</strong><ChevronRight size={18} /></button>)}</div><p>These are guide prompts, not generated answers or compliance findings.</p></div>
        </>}

        {section === 'proposal' && <>
          <SectionHeading eyebrow="PRE-SUBMISSION REVIEW / PROPOSAL" title="Check the proposal against the call." subtitle="Run the three priority questions and the requirement checklist, then inspect every cited source." aside={<span className="heading-count">{proposal.checklist.length} checks</span>} />
          <div className="proposal-run-card"><div><span className="dashboard-eyebrow">PROPOSAL ASSISTANT</span><h2>{proposal.checklist.length ? 'Review results are ready.' : 'Run the source-backed review.'}</h2><p>The backend reads files 01–06, verifies quoted evidence, and uses code for cost-share and construction comparisons. A full run can take a few minutes.</p></div><button className="solid-button" type="button" onClick={runProposalReview} disabled={proposalLoading || connection.mode !== 'connected'}>{proposalLoading ? 'Checking documents…' : proposal.checklist.length ? 'Run again' : 'Run proposal checks'} <ArrowRight size={16} /></button></div>
          <div className="proposal-prompts"><span className="dashboard-eyebrow">PRIORITY QUESTIONS</span>{proposalPrompts.map((item) => <button type="button" key={item.id} className={proposalQuestion === item.question ? 'active' : ''} onClick={() => { setProposalQuestion(item.question); setProposalAnswer(null); setProposalError('') }}><span>{item.id}</span><strong>{item.question}</strong></button>)}</div>
          <form className="ask-composer proposal-composer" onSubmit={submitProposalQuestion}><label htmlFor="proposal-question">Ask anything about the proposal</label><textarea id="proposal-question" value={proposalQuestion} onChange={(event) => setProposalQuestion(event.target.value)} placeholder="Where will the project operate, and what activities are proposed there?" rows={3} /><p className="proposal-scope-note">Automatically searches the funding call, preliminary proposal, PMF, and reviewer questions. <button type="button" onClick={() => { setQuestion(proposalQuestion); navigate('ask') }}>Use Ask the documents for reporting, agreement, or broader pack questions.</button></p><div><span>Every answer must include an exact, verified excerpt from the proposal sources.</span><button className="solid-button" type="submit" disabled={!proposalQuestion.trim() || proposalAsking || connection.mode !== 'connected'}>{proposalAsking ? 'Checking sources…' : 'Ask proposal'} <ArrowRight size={16} /></button></div></form>
          {proposalError && <div className="inline-error" role="alert">{proposalError}</div>}
          {proposal.failures.map((failure, index) => <div className="clean-banner proposal-failure" key={`${failure}-${index}`}><CircleAlert size={20} /><div><strong>One check needs another run</strong><p>{failure}</p></div></div>)}
          {proposalAnswer && <div className="answer-panel"><span className="dashboard-eyebrow">{proposalAnswer.status.replaceAll('_', ' ')} · REVIEW THE SOURCES</span><p>{proposalAnswer.answer}</p>{proposalAnswer.evidence.length ? <div className="answer-sources">{proposalAnswer.evidence.map((item, index) => <button type="button" key={`${item.documentId}-${index}`} onClick={() => openSource(item.documentId, item.locator.page)}>{documentById[item.documentId]?.shortTitle} · {evidenceLocation({ ...item, id: `${index}`, version: null, verified: false })}<ArrowUpRight size={15} /></button>)}</div> : <small>No source references were returned. Treat this as unverified.</small>}</div>}
          {proposal.findings.length > 0 && <section className="proposal-section"><div className="proposal-section-head"><div><span className="dashboard-eyebrow">PRIORITY FINDINGS</span><h2>What needs human review</h2></div><span>{proposal.findings.length} findings</span></div><div className="clean-list">{proposal.findings.map((item) => <button type="button" key={item.id} onClick={() => openSource(item.evidence[0].documentId, item.evidence[0].locator.page)}><span className="list-icon"><CircleAlert size={19} /></span><span className="list-copy"><small>{item.kind.replaceAll('_', ' ')} · {item.evidence.length} cited sources</small><strong>{item.title}</strong><span>{item.summary}</span></span><span className="row-status">{item.priority}</span><ChevronRight size={18} /></button>)}</div></section>}
          <section className="proposal-section"><div className="proposal-section-head"><div><span className="dashboard-eyebrow">CALL REQUIREMENTS</span><h2>Checklist against proposal 02</h2></div>{proposal.checklist.length > 0 && <span>{proposal.checklist.filter((row) => row.status === 'met').length} met</span>}</div>{proposal.checklist.length ? <div className="proposal-checklist">{proposal.checklist.map((row) => <article key={row.id}><div><span className={`proposal-status status-${row.status}`}>{row.status.replaceAll('_', ' ')}</span><small>{row.category.replaceAll('_', ' ')}</small></div><h3>{row.requirement}</h3><p>{row.reason}</p>{row.absentSources.length > 0 && <small className="proposal-absent">Not in pack: {row.absentSources.join(', ')}</small>}<div className="proposal-evidence">{row.evidence.map((item, index) => <button type="button" key={`${item.id}-${index}`} onClick={() => openSource(item.documentId, item.locator.page)}><strong>{item.documentId}</strong><span>{evidenceLocation(item)}</span><ArrowUpRight size={14} /></button>)}</div></article>)}</div> : <EmptyState icon={ClipboardCheck} title="No proposal checks run yet" description="Start the review to compare the nine call-requirement categories with the preliminary proposal." />}</section>
          {proposal.reviewerQuestions.length > 0 && <section className="proposal-section"><div className="proposal-section-head"><div><span className="dashboard-eyebrow">GAC REVIEW PREP</span><h2>Reviewer questions mapped</h2></div><span>{proposal.reviewerQuestions.length} questions</span></div><div className="reviewer-map">{proposal.reviewerQuestions.map((row, index) => <article key={`${row.question.id}-${index}`}><span className={`proposal-status status-${row.status}`}>{row.status.replaceAll('_', ' ')}</span><p>“{row.question.excerpt}”</p><small>{row.reason}</small><div className="proposal-evidence"><button type="button" onClick={() => openSource(row.question.documentId, row.question.locator.page)}><strong>06</strong><span>{evidenceLocation(row.question)}</span><ArrowUpRight size={14} /></button>{row.proposal.map((item, proposalIndex) => <button type="button" key={`${item.id}-${proposalIndex}`} onClick={() => openSource(item.documentId, item.locator.page)}><strong>02</strong><span>{evidenceLocation(item)}</span><ArrowUpRight size={14} /></button>)}</div></article>)}</div></section>}
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
          <SectionHeading eyebrow="REPORTING CALENDAR" title="Dates from the sources." subtitle="Dates appear here only when attached to a cited obligation. Conflicting dates stay in the issues view." aside={<span className="heading-count">{dates.length} sourced dates</span>} />
          {dates.length ? <div className="calendar-list">{dates.map((item) => <button type="button" key={item.id} onClick={() => openRequirement(item)}><span className="calendar-date">{formatDate(item.dueOn!)}</span><span><strong>{item.title}</strong><small>{item.category} · {item.evidence.length} source{item.evidence.length === 1 ? '' : 's'}</small></span><ChevronRight size={17} /></button>)}</div> : <EmptyState icon={CalendarDays} title="No sourced dates yet" description="The backend will calculate rule dates and compare them with asserted dates before this calendar is populated." />}
        </>}

        {section === 'documents' && <>
          <SectionHeading eyebrow="SOURCE LIBRARY / 00–06" title="Read the original." subtitle="The document is the center of this workspace. Citations open the relevant page or workbook reference." />
          <div className="source-workspace">
            <div className="source-rail"><span className="source-rail-label">SOURCE FILES</span><label className="source-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a document" aria-label="Find a document" /></label>{filteredDocuments.map((item) => { const Icon = item.format === 'PDF' ? FileText : FileSpreadsheet; return <button type="button" key={item.id} className={`source-rail-item ${document.id === item.id ? 'active' : ''}`} onClick={() => { setSelectedDocumentId(item.id); setSelectedPage(undefined); if (!focusedEvidence.some((evidence) => evidence.documentId === item.id) && !focusedInvestigation?.documentIds.includes(item.id)) setFocus(null) }}><span className="source-rail-icon"><Icon size={17} /></span><span><strong>{item.shortTitle}</strong><small>{item.id} · {item.format}</small></span></button> })}{filteredDocuments.length === 0 && <p className="no-results">No documents found.</p>}</div>
            <div className="source-center">
              {(focusedFinding || focusedRequirement || focusedInvestigation) && <div className="source-context"><span className="dashboard-eyebrow">{focusedFinding ? 'ISSUE UNDER REVIEW' : focusedRequirement ? 'EXTRACTED OBLIGATION' : `GUIDE QUESTION ${focusedInvestigation?.questionNumber}`}</span><h2>{focusedFinding?.title ?? focusedRequirement?.title ?? focusedInvestigation?.title}</h2><p>{focusedFinding?.summary ?? focusedRequirement?.statement ?? focusedInvestigation?.question}</p>{focusedFinding?.resolver && <p className="source-resolver"><strong>Suggested resolver:</strong> {focusedFinding.resolver}</p>}{focusedFinding && <button type="button" className="outline-button" onClick={() => setReviewFinding(focusedFinding)}>Record human review <ArrowRight size={16} /></button>}{focusedInvestigation && <small className="context-caveat">Investigation prompt from file 00; no finding has been generated.</small>}{focusedEvidence.length > 0 && <div className="source-evidence">{focusedEvidence.map((item) => <button type="button" key={item.id} className={document.id === item.documentId ? 'active' : ''} onClick={() => openSource(item.documentId, item.locator.page)}><span><strong>{documentById[item.documentId]?.shortTitle}</strong><small>{evidenceLocation(item)} · {item.verified ? 'Quote verified' : 'Needs verification'} · version {item.version ?? 'unknown'}</small></span><ChevronRight size={16} />{item.excerpt && <em>“{item.excerpt}”</em>}</button>)}</div>}</div>}
              <div className="source-document-head"><span><small>DOCUMENT {document.id} / {document.category.toUpperCase()}</small><strong>{document.title}</strong></span><a href={document.url} target="_blank" rel="noreferrer">{document.format === 'PDF' ? 'Open original' : 'Download workbook'} <ArrowUpRight size={16} /></a></div>
              {document.format === 'PDF' ? <Suspense fallback={<div className="pdf-message">Preparing document…</div>}><PdfPreview title={document.title} url={document.url} page={selectedPage} onPageChange={setSelectedPage} /></Suspense> : <div className="workbook-panel"><FileSpreadsheet size={34} /><h3>Workbook source</h3><p>Open the original spreadsheet to inspect its sheet and cell values. Any cited sheet and range appear in the evidence above.</p><a className="solid-button" href={document.url} download>Download workbook <ArrowUpRight size={16} /></a></div>}
            </div>
          </div>
        </>}

        {section === 'reviews' && <>
          <SectionHeading eyebrow="HUMAN DECISIONS" title="Review history." subtitle="Staff decisions are kept separate from generated findings and checked against the current source trail." aside={<span className="heading-count">{reviews.length} recorded</span>} />
          {reviews.length ? <div className="review-history">{[...reviews].reverse().map((record) => { const match = findings.find((item) => item.id === record.findingId); const stale = !match || record.fingerprint !== evidenceFingerprint(match); return <article key={record.id}><span className="list-icon"><ClipboardCheck size={18} /></span><div><div><strong>{record.findingTitle}</strong><span className={`review-badge ${stale ? 'stale' : ''}`}>{!match ? 'Finding unavailable' : stale ? 'Finding changed' : decisionLabel(record.decision)}</span></div><p>{record.note || record.correctedValue || 'No note added.'}</p><small>{new Date(record.recordedAt).toLocaleString()} · Stored in this browser</small></div></article> })}</div> : <EmptyState icon={ClipboardCheck} title="No decisions recorded yet" description="Open a cited finding to confirm, correct, dismiss, escalate, or request clarification. Your decision will appear here." />}
        </>}
      </main>
    </div>
    {reviewFinding && <ReviewDialog finding={reviewFinding} onClose={() => setReviewFinding(null)} onSave={saveReview} />}
    {notice && <div className="dashboard-toast" role="status"><CheckCircle2 size={17} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={16} /></button></div>}
  </div>
}
