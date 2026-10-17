import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Check, FileText, FolderOpen, GripVertical, Plus, Printer, Sparkles, Trash2, Upload } from 'lucide-react'
import { askProposalQuestion, askQuestion, type AskAnswer } from '../api'
import { type Finding, type ProposalChecklistRow, type ProposalWorkspace, type Requirement } from '../domain'
import { loadDraft, saveDraft, type Draft } from '../draft'
import { documentById } from '../documents'
import { addLocalDocument } from '../localDocuments'
import { createTemplateSections, preliminaryProposalTemplate } from '../proposalTemplate'

type Props = {
  projectId: string
  projectName: string
  findings?: Finding[]
  requirements?: Requirement[]
  analysisConnected?: boolean
  /** Proposal view owned by the dashboard; null/undefined when the proposal API is unavailable. */
  proposal?: ProposalWorkspace | null
  proposalBusy?: boolean
  proposalError?: string
  onRunProposal?: () => void
  onOpenIssue?: (finding: Finding) => void
  onOpenRequirement?: (requirement: Requirement) => void
  onOpenSource?: (documentId: string, page?: number, excerpt?: string) => void
  onOpenIntake?: () => void
}

const checklistLabel: Record<ProposalChecklistRow['status'], string> = { met: 'Met', not_met: 'Not met', unclear: 'Unclear', not_addressed: 'Not addressed' }

function splitSuggestions(answer: string): string[] {
  const lines = answer.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  if (lines.length > 1) return lines
  return answer.split(/(?<=[.!?])\s+(?=[A-Z])/).map((item) => item.trim()).filter(Boolean)
}

async function readUpload(file: File): Promise<{ parts: { heading: string; body: string }[]; pages?: number; kind: 'text' | 'pdf' }> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file under 10 MB.')
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const { pdfjs } = await import('react-pdf')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const task = pdfjs.getDocument({ data: bytes })
    try {
      const pdf = await task.promise
      if (pdf.numPages > 30) throw new Error('This browser demo reads up to 30 PDF pages. Choose a shorter file.')
      const pages: string[] = []
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim())
      }
      if (!pages.some((page) => page.trim())) throw new Error('No selectable text was found. This scanned PDF needs OCR before editing.')
      return { parts: pages.map((body, index) => ({ heading: `Page ${index + 1}`, body: body.slice(0, 10_000) })), pages: pdf.numPages, kind: 'pdf' }
    } finally { await task.destroy() }
  }
  if (!/\.(txt|md)$/i.test(file.name)) throw new Error('Use a PDF, TXT, or Markdown file for this browser demo.')
  const text = (await file.text()).slice(0, 100_000)
  if (!text.trim()) throw new Error('The file has no text to import.')
  return { parts: [{ heading: file.name.replace(/\.[^.]+$/, ''), body: text }], kind: 'text' }
}

export function DraftWorkspace({ projectId, projectName, findings = [], requirements = [], analysisConnected = false, proposal = null, proposalBusy = false, proposalError = '', onRunProposal, onOpenIssue, onOpenRequirement, onOpenSource, onOpenIntake }: Props) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(projectId, projectName))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState(draft.sections[0]?.id ?? '')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const [suggestedForId, setSuggestedForId] = useState<string | null>(null)
  const [addedItems, setAddedItems] = useState<number[]>([])
  const [selectedPhrase, setSelectedPhrase] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pageRefs = useRef<Record<string, HTMLElement | null>>({})
  const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const caretRef = useRef<{ id: string; start: number; end: number } | null>(null)
  const activeSection = draft.sections.find((item) => item.id === selectedId) ?? draft.sections[0]
  const suggestionItems = useMemo(() => answer ? splitSuggestions(answer.answer) : [], [answer])
  // Proposal analysis exists only for the bundled demo case; the dashboard passes it in.
  const proposalAvailable = analysisConnected && projectId === 'taps-for-rights' && proposal !== null
  const deskFindings = proposal?.findings.length ? proposal.findings : findings

  useEffect(() => { const next = loadDraft(projectId, projectName); setDraft(next); setSelectedId(next.sections[0]?.id ?? ''); setAnswer(null) }, [projectId, projectName])

  function openChecklistRow(row: ProposalChecklistRow) {
    const first = row.evidence[0]
    if (first) onOpenSource?.(first.documentId, first.locator.page, first.excerpt)
  }

  function commit(next: Draft, changed = true, keepSuggestion = false) {
    try { setDraft(saveDraft(projectId, { ...next, approvedAt: changed ? null : next.approvedAt })); if (!keepSuggestion) setAnswer(null); setError('') }
    catch { setError('Could not save this draft in browser storage. Export or copy your text before closing the page.') }
  }
  function editSection(id: string, field: 'heading' | 'body', value: string) {
    commit({ ...draft, sections: draft.sections.map((section) => section.id === id ? { ...section, [field]: value } : section) })
  }
  function addSection() {
    const id = crypto.randomUUID()
    commit({ ...draft, sections: [...draft.sections, { id, heading: 'New section', body: '', citations: [] }] })
    selectPage(id)
  }
  function removeSection(id: string) {
    if (draft.sections.length === 1) return
    const sections = draft.sections.filter((section) => section.id !== id)
    commit({ ...draft, sections })
    if (selectedId === id) setSelectedId(sections[0].id)
  }
  function moveSection(id: string, targetId: string) {
    const from = draft.sections.findIndex((item) => item.id === id)
    const to = draft.sections.findIndex((item) => item.id === targetId)
    if (from < 0 || to < 0 || from === to) return
    const sections = [...draft.sections]
    const [item] = sections.splice(from, 1)
    sections.splice(to, 0, item)
    commit({ ...draft, sections })
  }
  function selectPage(id: string) {
    setSelectedId(id)
    window.requestAnimationFrame(() => {
      pageRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      bodyRefs.current[id]?.focus({ preventScroll: true })
    })
  }
  function rememberCaret(id: string, element: HTMLTextAreaElement) {
    caretRef.current = { id, start: element.selectionStart, end: element.selectionEnd }
    setSelectedId(id)
  }
  function changeTemplate(id: string) {
    if (id === draft.templateId) return
    if (draft.sections.some((section) => section.body.trim()) && !window.confirm('Replace the current draft pages with this template? Your existing draft text will be removed.')) return
    const sections = id === preliminaryProposalTemplate.id ? createTemplateSections() : [{ id: crypto.randomUUID(), heading: 'Project overview', body: '', citations: [] }]
    commit({ ...draft, templateId: id as Draft['templateId'], sections })
    setSelectedId(sections[0].id)
    setNotice(id === preliminaryProposalTemplate.id ? 'Template added. Fill or adapt each page before approval.' : 'Blank draft ready.')
  }
  function insertText(fragment: string, index?: number, targetId = selectedId) {
    const section = draft.sections.find((item) => item.id === targetId)
    if (!section || !answer || suggestedForId !== targetId || answer.status === 'not_found' || !answer.evidence.length || !fragment.trim()) return
    const caret = caretRef.current?.id === targetId ? caretRef.current : null
    const start = caret ? Math.min(caret.start, section.body.length) : section.body.length
    const end = caret ? Math.min(caret.end, section.body.length) : start
    const before = section.body.slice(0, start)
    const after = section.body.slice(end)
    const inserted = `${before && !/\s$/.test(before) ? ' ' : ''}${fragment.trim()}${after && !/^\s/.test(after) ? ' ' : ''}`
    const nextBody = before + inserted + after
    const citations = [...section.citations]
    for (const evidence of answer.evidence) {
      if (!citations.some((item) => item.documentId === evidence.documentId && item.page === evidence.locator.page)) citations.push({ documentId: evidence.documentId, page: evidence.locator.page })
    }
    commit({ ...draft, sections: draft.sections.map((item) => item.id === targetId ? { ...item, body: nextBody, citations } : item) }, true, true)
    if (index !== undefined) setAddedItems((items) => [...items, index])
    setSelectedPhrase('')
    const position = start + inserted.length
    caretRef.current = { id: targetId, start: position, end: position }
    window.requestAnimationFrame(() => { const textarea = bodyRefs.current[targetId]; textarea?.focus(); textarea?.setSelectionRange(position, position) })
    setNotice('Added at the cursor. Review the source note before approval.')
  }
  async function importFile(file?: File, sourceDocumentId?: string) {
    if (!file) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { parts, pages, kind } = await readUpload(file)
      if (!sourceDocumentId) await addLocalDocument(projectId, file, 'Proposal')
      const imported = parts.map((part, index) => ({ id: crypto.randomUUID(), ...part, citations: sourceDocumentId ? [{ documentId: sourceDocumentId, page: index + 1 }] : [] }))
      const sections = draft.sections.length === 1 && !draft.sections[0].body.trim() && draft.sections[0].heading === 'Project overview' ? [] : draft.sections
      commit({ ...draft, sections: [...sections, ...imported], sources: [...draft.sources, { id: crypto.randomUUID(), name: file.name, kind, pages, addedAt: new Date().toISOString() }] })
      setSelectedId(imported[0].id)
      setNotice(`${file.name} imported as ${imported.length} editable ${imported.length === 1 ? 'section' : 'sections'}. Keep the original file for source verification.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this file.') }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }
  async function importCaseProposal() {
    setBusy(true); setError('')
    try {
      const source = documentById['02']
      const response = await fetch(source.url)
      if (!response.ok) throw new Error('Could not open the case proposal PDF.')
      const file = new File([await response.blob()], source.title + '.pdf', { type: 'application/pdf' })
      await importFile(file, '02')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the case proposal.') }
    finally { setBusy(false) }
  }
  async function requestSuggestion() {
    if (!activeSection || !question.trim()) return
    setBusy(true); setError(''); setAnswer(null); setAddedItems([]); setSelectedPhrase('')
    try {
      const prompt = `For the proposal section titled "${activeSection.heading}", ${question.trim()} Use only the supplied project source documents; say when evidence is insufficient. Current draft text: ${activeSection.body.slice(0, 1500)}`
      const response = proposalAvailable ? await askProposalQuestion(prompt) : await askQuestion(prompt)
      setSuggestedForId(activeSection.id)
      setAnswer(response)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The analysis service is unavailable.') }
    finally { setBusy(false) }
  }
  function approve() {
    if (!draft.sections.some((section) => section.body.trim())) { setError('Add draft content before approval.'); return }
    commit({ ...draft, approvedAt: new Date().toISOString() }, false)
    setNotice('Draft approved in this browser. Further edits will clear approval.')
  }
  function printDraft() {
    if (!draft.sections.some((section) => section.body.trim())) { setError('Add draft content before printing.'); return }
    window.print()
  }

  return <div className="draft-workspace">
    <div className="draft-topline">
      <div><span className="dashboard-eyebrow">PROJECT WORKSPACE / {projectName.toUpperCase()}</span><h1>Proposal draft</h1><p>Edit pages, review cited feedback, and record human approval.</p></div>
      <div className="draft-top-actions"><span className={`draft-status ${draft.approvedAt ? 'approved' : ''}`}>{draft.approvedAt ? <><Check size={14} /> Approved</> : 'Draft · needs review'}</span><button type="button" className="outline-button" onClick={printDraft}><Printer size={15} /> Print / save PDF</button></div>
    </div>
    {(error || notice) && <div className={error ? 'inline-error' : 'draft-notice'} role={error ? 'alert' : 'status'}>{error || notice}</div>}
    <div className="draft-layout">
      <aside className="draft-left" aria-label="Proposal pages">
        <div className="draft-panel-title"><strong>Template</strong></div>
        <label className="draft-template-label" htmlFor="draft-template">Start from</label>
        <select id="draft-template" aria-label="Proposal template" value={draft.templateId} onChange={(event) => changeTemplate(event.target.value)}><option value="blank">Blank document</option><option value={preliminaryProposalTemplate.id}>{preliminaryProposalTemplate.label}</option></select>
        {draft.templateId === preliminaryProposalTemplate.id && <small className="draft-template-note">{preliminaryProposalTemplate.description}</small>}
        <div className="draft-pages-heading"><strong>Pages</strong><small>{draft.sections.length}</small></div>
        <div className="draft-section-list">{draft.sections.map((section, index) => <div className={`draft-section-row ${selectedId === section.id ? 'selected' : ''}`} key={section.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragId) moveSection(dragId, section.id); setDragId(null) }}>
          <button type="button" className="draft-drag" draggable onDragStart={(event) => { setDragId(section.id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragId(null)} aria-label={`Drag page ${index + 1}`} title="Drag to reorder"><GripVertical size={16} /></button>
          <button type="button" className="draft-section-select" onClick={() => selectPage(section.id)}><small>{String(index + 1).padStart(2, '0')}</small><span>{section.heading || 'Untitled page'}</span></button>
          <div className="draft-order-buttons"><button type="button" aria-label={`Move ${section.heading} up`} disabled={index === 0} onClick={() => moveSection(section.id, draft.sections[index - 1].id)}><ArrowUp size={13} /></button><button type="button" aria-label={`Move ${section.heading} down`} disabled={index === draft.sections.length - 1} onClick={() => moveSection(section.id, draft.sections[index + 1].id)}><ArrowDown size={13} /></button></div>
        </div>)}</div>
        <button type="button" className="draft-add" onClick={addSection}><Plus size={15} /> Add page</button>
        <div className="draft-source-list"><div className="draft-panel-title"><strong>Source documents</strong><small>{draft.sources.length}</small></div>{draft.sources.map((source) => <span key={source.id}><FileText size={14} /> {source.name}</span>)}
          {projectId === 'taps-for-rights' && draft.sources.length === 0 && <button type="button" className="draft-upload" disabled={busy} onClick={() => void importCaseProposal()}><FileText size={16} /> Start from case proposal</button>}
          <button type="button" className="draft-upload" disabled={busy} onClick={() => inputRef.current?.click()}><Upload size={16} /> {busy ? 'Reading…' : 'Import into draft'}</button>
          <input ref={inputRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" hidden onChange={(event) => void importFile(event.target.files?.[0])} />
          {onOpenIntake && <button type="button" className="draft-library-link" onClick={onOpenIntake}><FolderOpen size={15} /> Open project documents <ArrowRight size={14} /></button>}
          <small>Import text PDFs, TXT, or MD into editable pages. Upload other source types in Project documents.</small>
        </div>
      </aside>
      <div className="draft-editor" aria-label="Proposal editor">
        <div className="draft-editor-toolbar"><span><FileText size={15} /> Editable document</span><span>Changes save in this browser</span></div>
        <div className="draft-page-stack">{draft.sections.map((section, index) => <section className={`draft-paper draft-page ${selectedId === section.id ? 'active' : ''}`} key={section.id} ref={(node) => { pageRefs.current[section.id] = node }} onClick={() => setSelectedId(section.id)} onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-grantguard-suggestion') || event.dataTransfer.types.includes('application/x-grantguard-page')) event.preventDefault() }} onDrop={(event) => {
          if (event.dataTransfer.types.includes('application/x-grantguard-page')) { event.preventDefault(); moveSection(event.dataTransfer.getData('application/x-grantguard-page'), section.id); return }
          if (event.dataTransfer.types.includes('application/x-grantguard-suggestion')) { event.preventDefault(); const item = Number(event.dataTransfer.getData('application/x-grantguard-suggestion')); if (Number.isInteger(item)) insertText(suggestionItems[item] ?? '', item, section.id) }
        }}>
          <div className="draft-paper-section-head"><span>PAGE {String(index + 1).padStart(2, '0')} / {String(draft.sections.length).padStart(2, '0')}</span><div><button type="button" draggable onDragStart={(event) => { setDragId(section.id); event.dataTransfer.setData('application/x-grantguard-page', section.id) }} onDragEnd={() => setDragId(null)} aria-label={`Drag page ${index + 1}`} title="Drag page to reorder"><GripVertical size={15} /></button><button type="button" onClick={() => removeSection(section.id)} disabled={draft.sections.length === 1} aria-label={`Delete ${section.heading}`} title="Delete page"><Trash2 size={15} /></button></div></div>
          {index === 0 && <input className="draft-title-input" aria-label="Proposal title" value={draft.title} onChange={(event) => commit({ ...draft, title: event.target.value })} placeholder="Proposal title" />}
          <input className="draft-page-heading" aria-label={`Heading for page ${index + 1}`} value={section.heading} onChange={(event) => editSection(section.id, 'heading', event.target.value)} placeholder="Page heading" />
          <textarea ref={(node) => { bodyRefs.current[section.id] = node }} aria-label={`Body for ${section.heading}`} value={section.body} onChange={(event) => editSection(section.id, 'body', event.target.value)} onSelect={(event) => rememberCaret(section.id, event.currentTarget)} onKeyUp={(event) => rememberCaret(section.id, event.currentTarget)} onClick={(event) => rememberCaret(section.id, event.currentTarget)} placeholder="Write here, or choose a template to begin…" rows={Math.max(10, Math.min(30, section.body.split('\n').length + 5))} />
          {section.citations.length > 0 && <div className="draft-citations"><small>SOURCE NOTES</small>{section.citations.map((citation, citationIndex) => <button type="button" key={`${citation.documentId}-${citation.page ?? 0}-${citationIndex}`} disabled={!onOpenSource} onClick={() => onOpenSource?.(citation.documentId, citation.page)}>{documentById[citation.documentId]?.shortTitle ?? `Document ${citation.documentId}`}{citation.page ? ` · page ${citation.page}` : ''}</button>)}</div>}
        </section>)}</div>
      </div>
      <aside className="draft-right" aria-label="Analysis and review">
        <div className="draft-panel-title"><strong>Review desk</strong><small>{analysisConnected ? 'Analysis connected' : 'Source review'}</small></div>
        <div className="draft-review-scroll">
          {proposalAvailable && <div className="draft-review-block"><span className="dashboard-eyebrow">PROPOSAL CHECKS</span>
            {proposal && (proposal.checklist.length > 0 || proposal.findings.length > 0) ? <p>Checked against the 2018 call and the pack. Each result needs human review.</p> : <p>No proposal checks have run since the analysis service started.</p>}
            <button type="button" className="draft-ask" onClick={() => onRunProposal?.()} disabled={proposalBusy || !onRunProposal}>{proposalBusy ? 'Running checks… (can take a few minutes)' : proposal?.checklist.length ? 'Re-run proposal checks' : 'Run proposal checks'} <ArrowRight size={14} /></button>
            {proposalError && <small className="draft-desk-error" role="alert">{proposalError}</small>}
            {proposal?.failures.map((failure) => <small className="draft-desk-error" key={failure}>{failure}</small>)}
          </div>}
          <div className="draft-review-block"><span className="dashboard-eyebrow">{proposal?.checklist.length ? 'CALL REQUIREMENTS' : 'REQUIREMENTS'}</span>{proposal?.checklist.length ? proposal.checklist.slice(0, 8).map((row) => <button type="button" className="draft-review-item" key={row.id} disabled={!row.evidence.length} onClick={() => openChecklistRow(row)} title={row.reason}><strong>{row.requirement}</strong><small><span className={`draft-check-status ${row.status}`}>{checklistLabel[row.status]}</span> {row.evidence.length} source {row.evidence.length === 1 ? 'reference' : 'references'} <ArrowRight size={12} /></small></button>) : requirements.length ? requirements.slice(0, 5).map((item) => <button type="button" className="draft-review-item" key={item.id} onClick={() => onOpenRequirement?.(item)}><strong>{item.title}</strong><small>{item.evidence.length} source {item.evidence.length === 1 ? 'reference' : 'references'} <ArrowRight size={12} /></small></button>) : <p>Requirements appear when project source analysis is connected.</p>}</div>
          <div className="draft-review-block"><span className="dashboard-eyebrow">ISSUES TO REVIEW</span>{deskFindings.length ? deskFindings.slice(0, 5).map((item) => <button type="button" className="draft-review-item" key={item.id} onClick={() => onOpenIssue?.(item)}><strong>{item.title}</strong><small>{item.state.replaceAll('_', ' ')}{item.resolver ? ` · who decides: ${item.resolver === 'gac' ? 'GAC' : 'Water Care staff'}` : ''} <ArrowRight size={12} /></small></button>) : <p>No cited issues loaded for this project.</p>}</div>
          <div className="draft-review-block"><span className="dashboard-eyebrow"><Sparkles size={13} /> AI WRITING HELP</span><p>Ask for cited feedback on the selected page. Choose individual lines to add to your draft.</p><textarea aria-label="Writing help request" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="How can I make this page clearer?" rows={3} /><button type="button" className="draft-ask" onClick={() => void requestSuggestion()} disabled={!analysisConnected || busy || !question.trim() || !activeSection}>{busy ? 'Checking…' : 'Get feedback'} <ArrowRight size={14} /></button>{!analysisConnected && <small>Connect the analysis service for cited feedback.</small>}
            {answer && <div className="draft-answer"><strong>{answer.status.replaceAll('_', ' ')}</strong><small>{answer.evidence.length} cited source{answer.evidence.length === 1 ? '' : 's'} returned</small>{suggestedForId && <small>For page: {draft.sections.find((section) => section.id === suggestedForId)?.heading ?? 'Removed page'}</small>}
              {suggestionItems.map((item, index) => <div className="draft-answer-item" key={`${index}-${item}`} onMouseUp={(event) => { if ((event.target as HTMLElement).closest('button')) return; const selection = window.getSelection(); setSelectedPhrase(selection?.anchorNode && selection.focusNode && event.currentTarget.contains(selection.anchorNode) && event.currentTarget.contains(selection.focusNode) ? selection.toString().trim() : '') }}><p>{item}</p>{answer.evidence.length > 0 && answer.status !== 'not_found' && <div className="draft-answer-actions"><button type="button" disabled={addedItems.includes(index) || selectedId !== suggestedForId} onClick={() => insertText(item, index)}>{addedItems.includes(index) ? 'Added' : 'Add to doc'}</button><button type="button" className="draft-suggestion-drag" draggable={!addedItems.includes(index)} onDragStart={(event) => event.dataTransfer.setData('application/x-grantguard-suggestion', String(index))} aria-label={`Drag suggestion ${index + 1} to a page`} title="Drag to a page"><GripVertical size={14} /></button></div>}</div>)}
              {selectedPhrase && answer.evidence.length > 0 && <button type="button" className="draft-add-selection" onMouseDown={(event) => event.preventDefault()} onClick={() => insertText(selectedPhrase)}>Add selected phrase to doc</button>}
              {answer.evidence.map((evidence, index) => <button className="draft-answer-source" type="button" key={`${evidence.documentId}-${index}`} disabled={!onOpenSource} onClick={() => onOpenSource?.(evidence.documentId, evidence.locator.page)}>{documentById[evidence.documentId]?.shortTitle ?? `Document ${evidence.documentId}`}{evidence.locator.page ? ` · page ${evidence.locator.page}` : ''} <ArrowRight size={13} /></button>)}
            </div>}
          </div>
          <div className="draft-review-block draft-approval"><span className="dashboard-eyebrow">HUMAN APPROVAL</span><p>Review the draft and sources before approving. Changes clear approval.</p><button type="button" onClick={approve}><Check size={15} /> Approve draft</button>{draft.approvedAt && <small>Approved {new Date(draft.approvedAt).toLocaleString()}</small>}</div>
        </div>
      </aside>
    </div>
    <article className="draft-print" aria-hidden="true"><h1>{draft.title}</h1>{draft.sections.map((section) => <section key={section.id}><h2>{section.heading}</h2><p>{section.body}</p>{section.citations.length > 0 && <small>Source notes: {section.citations.map((citation) => `${documentById[citation.documentId]?.shortTitle ?? `Document ${citation.documentId}`}${citation.page ? `, page ${citation.page}` : ''}`).join('; ')}</small>}</section>)}</article>
  </div>
}
