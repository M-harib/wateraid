import { lazy, Suspense } from 'react'
import { ArrowUpRight, BookOpenText, CheckCircle2, Download, FileSpreadsheet, FileText, Info, ScanSearch, ShieldCheck, TriangleAlert } from 'lucide-react'
import { documentById, type SourceDocument } from '../documents'
import { evidenceLocation, type Evidence, type Finding, type Requirement } from '../domain'
import type { Investigation } from '../investigations'
import { evidenceFingerprint, latestReviewFor, type ReviewRecord } from '../reviews'

const PdfPreview = lazy(() => import('./PdfPreview').then((module) => ({ default: module.PdfPreview })))

type Props = {
  document: SourceDocument
  finding?: Finding
  requirement?: Requirement
  investigation?: Investigation
  reviews: ReviewRecord[]
  onDocumentChange: (id: string, page?: number) => void
  onReview: (finding: Finding) => void
  page?: number
}

function EvidenceCard({ evidence, onOpen }: { evidence: Evidence; onOpen: () => void }) {
  const source = documentById[evidence.documentId]
  return (
    <article className="evidence-card">
      <div className="evidence-card-top">
        <span className="source-id">{evidence.documentId}</span>
        <div className="evidence-source-name">{source?.shortTitle ?? `Document ${evidence.documentId}`}</div>
        <span className={`verification ${evidence.verified ? 'is-verified' : ''}`}>
          {evidence.verified ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
          {evidence.verified ? 'Quote verified' : 'Needs verification'}
        </span>
      </div>
      <div className="evidence-locator">{evidenceLocation(evidence)} · Version {evidence.version ?? 'unknown'}</div>
      {evidence.excerpt ? <blockquote>“{evidence.excerpt}”</blockquote> : <p className="muted-small">No excerpt was supplied.</p>}
      <button className="text-action" type="button" onClick={onOpen}>View source <ArrowUpRight size={14} /></button>
    </article>
  )
}

export function EvidenceWorkspace({ document, finding, requirement, investigation, reviews, onDocumentChange, onReview, page }: Props) {
  const relevantIds = finding
    ? [...new Set(finding.evidence.map((evidence) => evidence.documentId))]
    : requirement
      ? [...new Set(requirement.evidence.map((evidence) => evidence.documentId))]
      : investigation?.documentIds ?? [document.id]
  const latestReview = finding ? latestReviewFor(finding.id, reviews) : undefined
  const isStale = !!(finding && latestReview && latestReview.fingerprint !== evidenceFingerprint(finding))
  const pdfUrl = `${document.url}#page=${page ?? 1}&view=FitH`

  return (
    <aside className="evidence-workspace" aria-label="Evidence workspace">
      <div className="workspace-heading">
        <div className="workspace-icon"><ScanSearch size={19} /></div>
        <div><span className="eyebrow">SOURCE WORKSPACE</span><h2>Evidence desk</h2></div>
      </div>

      {finding ? (
        <section className="workspace-context">
          <span className="context-kicker">REVIEWABLE FINDING</span>
          <h3>{finding.title}</h3>
          <p>{finding.summary}</p>
          <div className="context-line"><span>What needs attention</span><strong>{finding.nextAction}</strong></div>
          {latestReview && (
            <div className={`review-state ${isStale ? 'is-stale' : ''}`}>
              {isStale ? <TriangleAlert size={15} /> : <ShieldCheck size={15} />}
              {isStale ? 'Prior review is stale: evidence changed' : `Last review: ${latestReview.decision.replaceAll('_', ' ')}`}
            </div>
          )}
          <button className="button button-primary full-width" type="button" onClick={() => onReview(finding)}>Record human review</button>
        </section>
      ) : requirement ? (
        <section className="workspace-context">
          <span className="context-kicker">{requirement.category.toUpperCase()} · {requirement.status.replaceAll('_', ' ').toUpperCase()}</span>
          <h3>{requirement.title}</h3>
          <p>{requirement.statement}</p>
          {requirement.dueOn && <div className="context-line"><span>Recorded due date</span><strong>{requirement.dueOn}</strong></div>}
          <div className="unverified-note"><Info size={16} /><span>Extracted requirement. Check the source and review status before acting.</span></div>
        </section>
      ) : investigation ? (
        <section className="workspace-context">
          <span className="context-kicker">GUIDE QUESTION {String(investigation.questionNumber).padStart(2, '0')}</span>
          <h3>{investigation.title}</h3>
          <p>{investigation.question}</p>
          <div className="unverified-note"><Info size={16} /><span>This is an investigation prompt from file 00, not a generated finding.</span></div>
          <ol className="check-steps">{investigation.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
      ) : (
        <section className="workspace-context compact-context">
          <span className="context-kicker">SOURCE FILE {document.id}</span>
          <h3>{document.title}</h3>
          <p>{document.description}</p>
        </section>
      )}

      {(finding || requirement) && (
        <section className="evidence-list-section">
          <div className="section-topline"><span>Linked evidence</span><span>{(finding ?? requirement)!.evidence.length} source{(finding ?? requirement)!.evidence.length === 1 ? '' : 's'}</span></div>
          <div className="evidence-list">
            {(finding ?? requirement)!.evidence.map((evidence) => (
              <EvidenceCard key={evidence.id} evidence={evidence} onOpen={() => onDocumentChange(evidence.documentId, evidence.locator.page)} />
            ))}
          </div>
        </section>
      )}

      <section className="document-view-section">
        <div className="section-topline"><span>Open document</span><span>{relevantIds.length} suggested</span></div>
        <div className="document-switcher" role="group" aria-label="Suggested documents">
          {relevantIds.map((id) => {
            const source = documentById[id]
            if (!source) return null
            return <button key={id} type="button" className={`document-chip ${document.id === id ? 'active' : ''}`} onClick={() => onDocumentChange(id)}><span>{id}</span>{source.shortTitle}</button>
          })}
          {!relevantIds.includes(document.id) && <button type="button" className="document-chip active"><span>{document.id}</span>{document.shortTitle}</button>}
        </div>
        <div className="document-preview-head">
          <div className="document-preview-title">{document.format === 'PDF' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}<span>{document.shortTitle}</span></div>
          <span>{document.format}{page && document.format === 'PDF' ? ` · page ${page}` : ''}</span>
        </div>
        {document.format === 'PDF' ? (
          <Suspense fallback={<div className="pdf-message">Preparing PDF viewer…</div>}>
            <PdfPreview title={document.title} url={document.url} page={page} onPageChange={(nextPage) => onDocumentChange(document.id, nextPage)} />
          </Suspense>
        ) : (
          <div className="spreadsheet-preview"><FileSpreadsheet size={27} /><strong>Workbook evidence</strong><p>Sheet and cell references appear above when a finding is available. Open the original workbook to inspect its values.</p></div>
        )}
        <a className="open-original" href={document.format === 'PDF' ? pdfUrl : document.url} target="_blank" rel="noreferrer">
          {document.format === 'PDF' ? <BookOpenText size={16} /> : <Download size={16} />}
          {document.format === 'PDF' ? 'Open original PDF' : 'Download workbook'}
          <ArrowUpRight size={15} />
        </a>
      </section>
    </aside>
  )
}
