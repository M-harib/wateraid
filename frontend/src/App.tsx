import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BookOpenText, CalendarDays, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, Command, FileSearch2,
  FileSpreadsheet, FileText, FolderOpen, LayoutDashboard, Menu, Search, ShieldCheck,
  Sparkles, X,
} from 'lucide-react'
import { loadDashboard, type DashboardConnection } from './api'
import { EvidenceWorkspace } from './components/EvidenceWorkspace'
import { ReviewDialog } from './components/ReviewDialog'
import { documentById, documents, type SourceDocument } from './documents'
import type { Finding, Requirement } from './domain'
import { investigations, type Investigation } from './investigations'
import { appendReview, evidenceFingerprint, latestReviewFor, loadReviews, type ReviewDecision, type ReviewRecord } from './reviews'

type View = 'overview' | 'queue' | 'requirements' | 'documents' | 'reviews'

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'queue', label: 'Action queue', icon: ClipboardCheck },
  { id: 'requirements', label: 'Requirements', icon: BookOpenText },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'reviews', label: 'Review history', icon: ShieldCheck },
]

function formatCaseDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function reviewLabel(value: ReviewDecision): string {
  return ({
    confirmed: 'Confirmed',
    corrected: 'Corrected',
    dismissed: 'Dismissed',
    escalated: 'Escalated',
    clarification_requested: 'Clarification requested',
  })[value]
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span className="brand-drop" /><span className="brand-check" /></div>
}

function InvestigationRow({ item, selected, onClick }: { item: Investigation; selected: boolean; onClick: () => void }) {
  return (
    <button className={`queue-row ${selected ? 'is-selected' : ''}`} type="button" onClick={onClick}>
      <span className="queue-number">{String(item.questionNumber).padStart(2, '0')}</span>
      <span className="queue-row-copy">
        <span className="queue-row-meta"><span>{item.category}</span><span className="dot-divider" /> <span>Guide question</span></span>
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </span>
      <span className="queue-row-sources">{item.documentIds.map((id) => <span key={id}>{id}</span>)}</span>
      <ChevronRight className="queue-arrow" size={18} />
    </button>
  )
}

function FindingRow({ item, selected, review, onClick }: { item: Finding; selected: boolean; review?: ReviewRecord; onClick: () => void }) {
  const stale = !!(review && review.fingerprint !== evidenceFingerprint(item))
  return (
    <button className={`queue-row ${selected ? 'is-selected' : ''}`} type="button" onClick={onClick}>
      <span className={`priority-icon priority-${item.priority}`}><CircleAlert size={18} /></span>
      <span className="queue-row-copy">
        <span className="queue-row-meta"><span>{item.kind.replaceAll('_', ' ')}</span><span className="dot-divider" /><span>{item.evidence.length} cited source{item.evidence.length === 1 ? '' : 's'}</span></span>
        <strong>{item.title}</strong>
        <small>{item.summary}</small>
      </span>
      <span className={`status-pill ${stale ? 'status-stale' : review ? 'status-reviewed' : ''}`}>
        {stale ? 'Review stale' : review ? reviewLabel(review.decision) : item.state.replaceAll('_', ' ')}
      </span>
      <ChevronRight className="queue-arrow" size={18} />
    </button>
  )
}

function DocumentCard({ document, selected, onClick }: { document: SourceDocument; selected: boolean; onClick: () => void }) {
  const Icon = document.format === 'PDF' ? FileText : FileSpreadsheet
  return (
    <button className={`document-card ${selected ? 'is-selected' : ''}`} type="button" onClick={onClick}>
      <div className="document-card-top"><span className="document-icon"><Icon size={21} /></span><span className="document-index">{document.id}</span></div>
      <span className="document-category">{document.category} · {document.format}</span>
      <strong>{document.title}</strong>
      <small>{document.description}</small>
      <span className="document-card-link">Inspect source <ArrowUpRight size={15} /></span>
    </button>
  )
}

function RequirementRow({ item, selected, onClick }: { item: Requirement; selected: boolean; onClick: () => void }) {
  return <button className={`requirement-row ${selected ? 'is-selected' : ''}`} type="button" onClick={onClick}>
    <span className="requirement-row-icon"><BookOpenText size={18} /></span>
    <span className="queue-row-copy"><span className="queue-row-meta"><span>{item.category}</span><span className="dot-divider" /><span>{item.evidence.length} cited source{item.evidence.length === 1 ? '' : 's'}</span></span><strong>{item.title}</strong><small>{item.statement}</small></span>
    <span className="requirement-row-date">{item.dueOn ?? 'No due date'}</span><ChevronRight className="queue-arrow" size={18} />
  </button>
}

export default function App() {
  const [connection, setConnection] = useState<DashboardConnection>({ mode: 'preview', data: { projectName: 'Taps for Rights', asOf: '2022-06-30', findings: [], requirements: [] } })
  const [activeView, setActiveView] = useState<View>('overview')
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>('question-08')
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null)
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('03')
  const [selectedPage, setSelectedPage] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [reviews, setReviews] = useState<ReviewRecord[]>(() => loadReviews())
  const [reviewFinding, setReviewFinding] = useState<Finding | null>(null)
  const [toast, setToast] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    let active = true
    loadDashboard().then((result) => {
      if (!active) return
      setConnection(result)
      const firstFinding = result.data.findings[0]
      if (firstFinding) {
        setSelectedFindingId(firstFinding.id)
        setSelectedInvestigationId(null)
        setSelectedDocumentId(firstFinding.evidence[0].documentId)
        setSelectedPage(firstFinding.evidence[0].locator.page)
      } else if (result.data.requirements[0]) {
        const firstRequirement = result.data.requirements[0]
        setSelectedRequirementId(firstRequirement.id)
        setSelectedInvestigationId(null)
        setSelectedDocumentId(firstRequirement.evidence[0].documentId)
        setSelectedPage(firstRequirement.evidence[0].locator.page)
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const onSearchShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || target?.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target?.tagName ?? '')) return
      const input = document.querySelector<HTMLInputElement>('.search-field input')
      if (input) {
        event.preventDefault()
        input.focus()
      }
    }
    window.addEventListener('keydown', onSearchShortcut)
    return () => window.removeEventListener('keydown', onSearchShortcut)
  }, [])

  const findings = connection.data.findings
  const requirements = connection.data.requirements
  const selectedFinding = findings.find((finding) => finding.id === selectedFindingId)
  const selectedRequirement = requirements.find((requirement) => requirement.id === selectedRequirementId)
  const selectedInvestigation = investigations.find((item) => item.id === selectedInvestigationId)
  const selectedDocument = documentById[selectedDocumentId] ?? documents[0]
  const normalizedSearch = search.trim().toLowerCase()
  const filteredFindings = useMemo(() => findings.filter((finding) => `${finding.title} ${finding.summary} ${finding.kind}`.toLowerCase().includes(normalizedSearch)), [findings, normalizedSearch])
  const filteredInvestigations = useMemo(() => investigations.filter((item) => `${item.title} ${item.question} ${item.description}`.toLowerCase().includes(normalizedSearch)), [normalizedSearch])
  const filteredDocuments = useMemo(() => documents.filter((document) => `${document.title} ${document.description} ${document.category}`.toLowerCase().includes(normalizedSearch)), [normalizedSearch])
  const filteredRequirements = useMemo(() => requirements.filter((requirement) => `${requirement.title} ${requirement.statement} ${requirement.category}`.toLowerCase().includes(normalizedSearch)), [requirements, normalizedSearch])
  const reviewCount = findings.filter((finding) => {
    const latest = latestReviewFor(finding.id, reviews)
    return latest && latest.fingerprint === evidenceFingerprint(finding)
  }).length

  function selectView(view: View) {
    setActiveView(view)
    setMobileNavOpen(false)
    setSearch('')
  }

  function selectInvestigation(item: Investigation) {
    setSelectedInvestigationId(item.id)
    setSelectedFindingId(null)
    setSelectedRequirementId(null)
    setSelectedDocumentId(item.documentIds[0])
    setSelectedPage(undefined)
    setActiveView('queue')
  }

  function selectFinding(item: Finding) {
    setSelectedFindingId(item.id)
    setSelectedInvestigationId(null)
    setSelectedRequirementId(null)
    setSelectedDocumentId(item.evidence[0].documentId)
    setSelectedPage(item.evidence[0].locator.page)
    setActiveView('queue')
  }

  function selectRequirement(item: Requirement) {
    setSelectedRequirementId(item.id)
    setSelectedFindingId(null)
    setSelectedInvestigationId(null)
    setSelectedDocumentId(item.evidence[0].documentId)
    setSelectedPage(item.evidence[0].locator.page)
    setActiveView('requirements')
  }

  function selectDocument(document: SourceDocument) {
    setSelectedDocumentId(document.id)
    setSelectedPage(undefined)
    setSelectedFindingId(null)
    setSelectedRequirementId(null)
    setSelectedInvestigationId(null)
    setActiveView('documents')
  }

  function saveReview(decision: ReviewDecision, note: string, correctedValue?: string) {
    if (!reviewFinding) return
    const record: ReviewRecord = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      findingId: reviewFinding.id,
      findingTitle: reviewFinding.title,
      fingerprint: evidenceFingerprint(reviewFinding),
      decision,
      note,
      ...(correctedValue ? { correctedValue } : {}),
      recordedAt: new Date().toISOString(),
    }
    try {
      setReviews(appendReview(record))
      setReviewFinding(null)
      setToast(`${reviewLabel(decision)} · saved in this browser`)
    } catch {
      setToast('Could not save the decision in this browser')
    }
  }

  const queueTitle = findings.length ? 'Findings requiring attention' : 'Questions to investigate'
  const queueSubtitle = findings.length
    ? 'Every finding is a prompt for staff review, with its source trail alongside.'
    : 'From the participant guide. These are not generated findings or compliance conclusions.'

  return (
    <div className="app-shell">
      <button className="mobile-menu-button" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
      {mobileNavOpen && <div className="mobile-nav-scrim" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="brand-row"><BrandMark /><div className="brand-copy"><strong>GrantGuard</strong><span>Evidence workspace</span></div><button className="mobile-close icon-button" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="workspace-picker"><span className="workspace-avatar">WC</span><span><strong>Water Care</strong><small>Taps for Rights</small></span></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`side-nav-item ${activeView === id ? 'active' : ''}`} onClick={() => selectView(id)} aria-current={activeView === id ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === 'queue' && <em>{findings.length || investigations.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">CURRENT CASE</div>
        <div className="case-note"><span className="case-note-icon"><CalendarDays size={17} /></span><span><strong>Historical scenario</strong><small>As of {formatCaseDate(connection.data.asOf)}</small></span></div>
        <div className="sidebar-spacer" />
        <div className="sidebar-principle"><span className="principle-icon"><ShieldCheck size={18} /></span><strong>AI suggests.<br />Humans decide.</strong><small>Every material issue needs a source and a reviewer.</small></div>
        <div className="sidebar-footer"><span className="footer-avatar">GG</span><span><strong>GrantGuard prototype</strong><small>WaterAid Canada · A6</small></span></div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={15} /><strong>{navItems.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="topbar-actions"><span className={`connection-dot ${connection.mode === 'connected' ? 'connected' : ''}`} /><span>{connection.mode === 'connected' ? connection.message ? 'Findings connected' : 'Analysis connected' : connection.mode === 'unavailable' ? 'Service unavailable' : 'Source pack preview'}</span><span className="topbar-separator" /><span className="case-date">30 Jun 2022 case view</span></div>
        </header>

        <main className="page-content">
          <div className="page-heading-row">
            <div>
              <div className="page-eyebrow"><span className="eyebrow-line" /> WATER CARE / TAPS FOR RIGHTS</div>
              <h1>{activeView === 'overview' ? <>Clarity for every <em>commitment.</em></> : activeView === 'queue' ? <>What needs <em>attention.</em></> : activeView === 'requirements' ? <>Every obligation, <em>traceable.</em></> : activeView === 'documents' ? <>Your source <em>library.</em></> : <>Decisions with a <em>trail.</em></>}</h1>
              <p className="page-subtitle">{activeView === 'overview' ? 'An evidence-first view of grant obligations, questions and human decisions.' : activeView === 'queue' ? queueSubtitle : activeView === 'requirements' ? 'A source-linked register for the requirements that staff need to track.' : activeView === 'documents' ? 'The original files behind every future finding, ready to inspect.' : 'A clear record of how staff reviewed each evidence-backed finding.'}</p>
            </div>
            <div className="asof-card"><CalendarDays size={17} /><span><small>CASE DATE</small><strong>{formatCaseDate(connection.data.asOf)}</strong></span></div>
          </div>

          {connection.mode !== 'connected' && (
            <div className={`preview-banner ${connection.mode === 'unavailable' ? 'is-error' : ''}`}>
              <span className="preview-banner-icon"><Sparkles size={18} /></span>
              <span><strong>{connection.mode === 'unavailable' ? 'Analysis service unavailable' : 'Source pack preview'}</strong><small>{connection.mode === 'unavailable' ? `${connection.message}. The original files remain available below.` : 'The seven source files are available. No grant findings have been generated or verified yet.'}</small></span>
              <span className="preview-banner-tag">NO COMPLIANCE VERDICT</span>
            </div>
          )}
          {connection.mode === 'connected' && connection.message && <div className="preview-banner is-error"><span className="preview-banner-icon"><CircleAlert size={18} /></span><span><strong>Requirements feed pending</strong><small>{connection.message}. Findings remain available for review.</small></span></div>}

          {activeView === 'overview' && (
            <>
              <section className="metric-grid" aria-label="Workspace summary">
                <div className="metric-card"><div className="metric-icon metric-icon-green"><BookOpenText size={19} /></div><span>Source documents</span><strong>{String(documents.length).padStart(2, '0')}</strong><small>Original pack files available</small></div>
                <div className="metric-card"><div className="metric-icon metric-icon-amber"><FileSearch2 size={19} /></div><span>{findings.length ? 'Findings to review' : 'Guide questions in focus'}</span><strong>{String(findings.length || investigations.length).padStart(2, '0')}</strong><small>{findings.length ? 'Require a staff decision' : 'No answers preloaded'}</small></div>
                <div className="metric-card"><div className="metric-icon metric-icon-blue"><CheckCircle2 size={19} /></div><span>Current reviews</span><strong>{String(reviewCount).padStart(2, '0')}</strong><small>Matched to current evidence</small></div>
              </section>
              <section className="queue-section">
                <div className="section-heading"><div><span className="section-eyebrow">PRIORITY WORKSPACE</span><h2>{queueTitle}</h2><p>{queueSubtitle}</p></div><button className="text-action view-all" type="button" onClick={() => selectView('queue')}>View queue <ArrowRight size={16} /></button></div>
                <div className="queue-list">
                  {findings.length ? findings.slice(0, 3).map((finding) => <FindingRow key={finding.id} item={finding} selected={selectedFindingId === finding.id} review={latestReviewFor(finding.id, reviews)} onClick={() => selectFinding(finding)} />) : investigations.map((item) => <InvestigationRow key={item.id} item={item} selected={selectedInvestigationId === item.id} onClick={() => selectInvestigation(item)} />)}
                </div>
              </section>
              <section className="process-card"><div className="process-intro"><span className="section-eyebrow">BUILT FOR REVIEW</span><h2>From source to action.</h2><p>Each issue should answer the same four questions before a person decides what to do.</p></div><div className="process-steps"><div><span>01</span><strong>What is required?</strong><small>Capture the exact obligation.</small></div><div><span>02</span><strong>Where is the evidence?</strong><small>Open the original passage.</small></div><div><span>03</span><strong>What changed?</strong><small>Compare records without hiding conflicts.</small></div><div><span>04</span><strong>Who decides?</strong><small>Record the human outcome.</small></div></div></section>
            </>
          )}

          {activeView === 'queue' && (
            <section className="queue-section full-section">
              <div className="section-heading"><div><span className="section-eyebrow">ACTION QUEUE</span><h2>{queueTitle}</h2><p>{queueSubtitle}</p></div><span className="count-badge">{findings.length || investigations.length} items</span></div>
              <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions or findings" aria-label="Search questions or findings" /><kbd>/</kbd></label>
              <div className="queue-list">
                {findings.length ? filteredFindings.map((finding) => <FindingRow key={finding.id} item={finding} selected={selectedFindingId === finding.id} review={latestReviewFor(finding.id, reviews)} onClick={() => selectFinding(finding)} />) : filteredInvestigations.map((item) => <InvestigationRow key={item.id} item={item} selected={selectedInvestigationId === item.id} onClick={() => selectInvestigation(item)} />)}
                {(findings.length ? filteredFindings.length : filteredInvestigations.length) === 0 && <div className="empty-search">No matching items. Try a different search.</div>}
              </div>
              {!findings.length && <div className="queue-footnote"><CircleAlert size={16} /><span>These questions come from the challenge guide, page 3. They are investigation starters, not AI findings.</span></div>}
            </section>
          )}

          {activeView === 'documents' && (
            <section className="documents-section">
              <div className="section-heading"><div><span className="section-eyebrow">SOURCE REGISTRY</span><h2>Seven files. One traceable view.</h2><p>Select a file to inspect it in the evidence desk.</p></div><span className="count-badge">00—06</span></div>
              <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search source files" aria-label="Search source files" /><kbd>/</kbd></label>
              <div className="document-grid">{filteredDocuments.map((document) => <DocumentCard key={document.id} document={document} selected={selectedDocumentId === document.id && !selectedFinding && !selectedRequirement && !selectedInvestigation} onClick={() => selectDocument(document)} />)}</div>
              {filteredDocuments.length === 0 && <div className="empty-search">No matching documents.</div>}
            </section>
          )}

          {activeView === 'requirements' && (
            <section className="requirements-section">
              <div className="section-heading"><div><span className="section-eyebrow">REQUIREMENTS REGISTER</span><h2>Obligations with their evidence.</h2><p>Extracted statements appear here only when the analysis service supplies citations.</p></div><span className="count-badge">{requirements.length} extracted</span></div>
              {requirements.length ? <><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search obligations" aria-label="Search obligations" /><kbd>/</kbd></label><div className="queue-list">{filteredRequirements.map((item) => <RequirementRow key={item.id} item={item} selected={selectedRequirementId === item.id} onClick={() => selectRequirement(item)} />)}{filteredRequirements.length === 0 && <div className="empty-search">No matching requirements.</div>}</div></> : <div className="empty-state"><span className="empty-state-icon"><BookOpenText size={28} /></span><h3>No extracted obligations yet</h3><p>The source pack is ready. Once the backend returns cited obligations, this register will show each requirement, its source, review status and due date.</p><button className="button button-outline" type="button" onClick={() => selectView('documents')}>Inspect source files <ArrowRight size={16} /></button></div>}
              <div className="calendar-summary"><span className="calendar-summary-icon"><CalendarDays size={19} /></span><span><strong>Reporting calendar</strong><small>{requirements.some((item) => item.dueOn) ? `${requirements.filter((item) => item.dueOn).length} sourced date${requirements.filter((item) => item.dueOn).length === 1 ? '' : 's'} in the register` : 'No sourced deadlines available yet'}</small></span></div>
            </section>
          )}

          {activeView === 'reviews' && (
            <section className="reviews-section">
              <div className="section-heading"><div><span className="section-eyebrow">HUMAN-IN-THE-LOOP</span><h2>Review history</h2><p>Decisions stay separate from generated findings and are tied to their evidence.</p></div><span className="count-badge">{reviews.length} recorded</span></div>
              {reviews.length ? <div className="review-log">{[...reviews].reverse().map((record) => { const matching = findings.find((finding) => finding.id === record.findingId); const stale = !matching || record.fingerprint !== evidenceFingerprint(matching); return <article className="review-log-item" key={record.id}><div className="review-log-icon"><ShieldCheck size={18} /></div><div><div className="review-log-top"><strong>{record.findingTitle}</strong><span className={`status-pill ${stale ? 'status-stale' : 'status-reviewed'}`}>{!matching ? 'Finding unavailable' : stale ? 'Finding changed' : reviewLabel(record.decision)}</span></div><p>{record.note || record.correctedValue || 'No note added.'}</p><small>{new Date(record.recordedAt).toLocaleString()} · Stored in this browser</small></div></article> })}</div> : <div className="empty-state"><span className="empty-state-icon"><ClipboardCheck size={28} /></span><h3>No decisions recorded yet</h3><p>When verified findings are available, staff can confirm, correct, dismiss, escalate, or request clarification. Their decisions will appear here.</p><button className="button button-outline" type="button" onClick={() => selectView('queue')}>Go to action queue <ArrowRight size={16} /></button></div>}
            </section>
          )}
        </main>
      </div>

      <EvidenceWorkspace
        document={selectedDocument}
        finding={selectedFinding}
        requirement={selectedRequirement}
        investigation={selectedInvestigation}
        reviews={reviews}
        page={selectedPage}
        onDocumentChange={(id, page) => { setSelectedDocumentId(id); setSelectedPage(page) }}
        onReview={setReviewFinding}
      />
      {reviewFinding && <ReviewDialog finding={reviewFinding} onClose={() => setReviewFinding(null)} onSave={saveReview} />}
      {toast && <div className="toast" role="status"><Command size={16} />{toast}<button type="button" onClick={() => setToast('')} aria-label="Dismiss notice"><X size={14} /></button></div>}
      <button className="skip-link" type="button" onClick={() => document.querySelector('main')?.scrollIntoView()}>Skip to content <ArrowDownRight size={14} /></button>
    </div>
  )
}
