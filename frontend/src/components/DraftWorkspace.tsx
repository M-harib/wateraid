import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Check, Copy, FileText, FolderOpen, GripVertical, Plus, Printer, Redo2, Sparkles, Trash2, Undo2, Upload } from 'lucide-react'
import { requestWritingHelp, type WritingHelp } from '../api'
import { evidenceLocation, type Evidence, type Finding, type ProposalChecklistRow, type ProposalWorkspace, type Requirement } from '../domain'
import { loadDraft, saveDraft, type Draft } from '../draft'
import { documentById } from '../documents'
import { addLocalDocument } from '../localDocuments'
import { createTemplateSections, preliminaryProposalTemplate } from '../proposalTemplate'
import { sampleSuggestionsFor, suggestionsAsBullets } from '../reviewDeskMock'

type Props = {
  projectId: string
  projectName: string
  findings?: Finding[]
  requirements?: Requirement[]
  analysisConnected?: boolean
  /** Proposal view owned by the dashboard; null/undefined when the proposal API is unavailable. */
  proposal?: ProposalWorkspace | null
  onOpenIssue?: (finding: Finding) => void
  onOpenRequirement?: (requirement: Requirement) => void
  onOpenSource?: (documentId: string, page?: number, excerpt?: string) => void
  onOpenIntake?: () => void
}

const checklistLabel: Record<ProposalChecklistRow['status'], string> = { met: 'Met', not_met: 'Not met', unclear: 'Unclear', not_addressed: 'Not addressed' }

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall back below */ }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'; area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try { return document.execCommand('copy') } catch { return false } finally { area.remove() }
}

// Character offset under a screen point in a textarea. Textareas expose no hit-testing, so lay a
// transparent copy with the same text and box over it and ask the browser which character is there.
function textIndexAtPoint(textarea: HTMLTextAreaElement, x: number, y: number): number | null {
  const style = window.getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()
  const mirror = document.createElement('div')
  for (const name of ['font', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'textIndent', 'padding', 'borderWidth', 'borderStyle', 'boxSizing', 'tabSize'] as const) mirror.style[name] = style[name]
  Object.assign(mirror.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', borderColor: 'transparent', color: 'transparent', background: 'transparent', opacity: '0', zIndex: '2147483647', margin: '0' })
  mirror.textContent = textarea.value + '\u200b'
  document.body.appendChild(mirror)
  mirror.scrollTop = textarea.scrollTop
  try {
    const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
    const position = doc.caretPositionFromPoint?.(x, y)
    if (position && mirror.contains(position.offsetNode)) return Math.min(position.offset, textarea.value.length)
    const range = document.caretRangeFromPoint?.(x, y)
    if (range && mirror.contains(range.startContainer)) return Math.min(range.startOffset, textarea.value.length)
    return null
  } finally { mirror.remove() }
}

function withPlaceholders(text: string) {
  return text.split(/(\[[^\[\]]+\])/).map((part, index) => /^\[[^\[\]]+\]$/.test(part) ? <mark className="draft-placeholder" key={index}>{part}</mark> : part)
}

function WritingSources({ item, onOpenSource }: { item: { evidence: Evidence[]; draftQuotes: string[] }; onOpenSource?: (documentId: string, page?: number, excerpt?: string) => void }) {
  return <div className="draft-help-sources">
    {item.evidence.map((evidence, index) => <button type="button" key={`${evidence.id}-${index}`} disabled={!onOpenSource} title={evidence.excerpt} onClick={() => onOpenSource?.(evidence.documentId, evidence.locator.page, evidence.excerpt)}>{documentById[evidence.documentId]?.shortTitle ?? `Document ${evidence.documentId}`} · {evidenceLocation(evidence)} <ArrowRight size={11} /></button>)}
    {item.draftQuotes.map((quote) => <q key={quote} title="Quoted from this page of your draft">Your draft: {quote.length > 90 ? `${quote.slice(0, 90)}…` : quote}</q>)}
  </div>
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

export function DraftWorkspace({ projectId, projectName, findings = [], requirements = [], analysisConnected = false, proposal = null, onOpenIssue, onOpenRequirement, onOpenSource, onOpenIntake }: Props) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(projectId, projectName))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState(draft.sections[0]?.id ?? '')
  const [question, setQuestion] = useState('')
  const [help, setHelp] = useState<WritingHelp | null>(null)
  const [suggestedForId, setSuggestedForId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [copiedFor, setCopiedFor] = useState<string | null>(null)
  // Last AI suggestion copied from the desk; pasting exactly this text into a page also adds its source notes.
  const [copiedSuggestion, setCopiedSuggestion] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pageRefs = useRef<Record<string, HTMLElement | null>>({})
  const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const caretRef = useRef<{ id: string; start: number; end: number } | null>(null)
  // Undo history for the draft. Typing in one field within a second counts as one step.
  const historyRef = useRef<{ past: Draft[]; future: Draft[]; lastKey: string; lastAt: number }>({ past: [], future: [], lastKey: '', lastAt: 0 })
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 })
  const activeSection = draft.sections.find((item) => item.id === selectedId) ?? draft.sections[0]
  const deskFindings = proposal?.findings.length ? proposal.findings : findings
  // Sample data for the Taps for Rights demo only; see reviewDeskMock.ts.
  const sampleSet = projectId === 'taps-for-rights' && activeSection ? sampleSuggestionsFor(activeSection) : null


  useEffect(() => {
    const next = loadDraft(projectId, projectName)
    setDraft(next); setSelectedId(next.sections[0]?.id ?? ''); setHelp(null)
    historyRef.current = { past: [], future: [], lastKey: '', lastAt: 0 }; setHistorySize({ undo: 0, redo: 0 })
  }, [projectId, projectName])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      // Leave native undo to fields outside the draft pages (writing-help request, template picker).
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select') && !target.closest('.draft-page')) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) redo(); else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function openChecklistRow(row: ProposalChecklistRow) {
    const first = row.evidence[0]
    if (first) onOpenSource?.(first.documentId, first.locator.page, first.excerpt)
  }

  function persist(next: Draft) {
    try { setDraft(saveDraft(projectId, next)); setError('') }
    catch { setError('Could not save this draft in browser storage. Export or copy your text before closing the page.') }
  }
  function commit(next: Draft, groupKey = '') {
    const history = historyRef.current
    const now = Date.now()
    if (!groupKey || groupKey !== history.lastKey || now - history.lastAt > 1000) {
      history.past.push(draft)
      if (history.past.length > 100) history.past.shift()
    }
    history.future = []; history.lastKey = groupKey; history.lastAt = now
    setHistorySize({ undo: history.past.length, redo: 0 })
    persist(next)
  }
  function restore(from: Draft[], to: Draft[]) {
    const previous = from.pop()
    if (!previous) return
    to.push(draft)
    historyRef.current.lastKey = ''
    setHistorySize({ undo: historyRef.current.past.length, redo: historyRef.current.future.length })
    persist(previous)
    if (!previous.sections.some((section) => section.id === selectedId)) setSelectedId(previous.sections[0]?.id ?? '')
  }
  function undo() { restore(historyRef.current.past, historyRef.current.future) }
  function redo() { restore(historyRef.current.future, historyRef.current.past) }
  function withCitations(citations: Draft['sections'][number]['citations'], sources: Evidence[]) {
    const next = [...citations]
    for (const evidence of sources) {
      if (!next.some((item) => item.documentId === evidence.documentId && item.page === evidence.locator.page)) next.push({ documentId: evidence.documentId, page: evidence.locator.page })
    }
    return next
  }
  function editSection(id: string, field: 'heading' | 'body', value: string) {
    commit({ ...draft, sections: draft.sections.map((section) => section.id === id ? { ...section, [field]: value } : section) }, `${id}:${field}`)
  }
  function dropSuggestion(event: DragEvent<HTMLElement>, sectionId: string) {
    const sentence = help?.sentences[Number(event.dataTransfer.getData('application/x-grantguard-suggestion'))]
    if (!sentence) return
    event.preventDefault()
    const textarea = bodyRefs.current[sectionId]
    const at = textarea && event.target === textarea ? textIndexAtPoint(textarea, event.clientX, event.clientY) : null
    insertText(sentence.text, sentence.evidence, sectionId, at)
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
    const focusedBefore = document.activeElement
    window.requestAnimationFrame(() => {
      pageRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Don't pull focus away from a field the user moved to in the meantime.
      if (document.activeElement === focusedBefore || document.activeElement === document.body) bodyRefs.current[id]?.focus({ preventScroll: true })
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
    setNotice(id === preliminaryProposalTemplate.id ? 'Template added. Fill or adapt each page.' : 'Blank draft ready.')
  }
  function insertText(fragment: string, sources: Evidence[], targetId = selectedId, dropAt: number | null = null) {
    const section = draft.sections.find((item) => item.id === targetId)
    if (!section || !fragment.trim()) return
    const caret = dropAt !== null ? { start: dropAt, end: dropAt } : caretRef.current?.id === targetId ? caretRef.current : null
    const start = caret ? Math.min(caret.start, section.body.length) : section.body.length
    const end = caret ? Math.min(caret.end, section.body.length) : start
    const before = section.body.slice(0, start)
    const after = section.body.slice(end)
    const inserted = `${before && !/\s$/.test(before) ? ' ' : ''}${fragment.trim()}${after && !/^\s/.test(after) ? ' ' : ''}`
    const nextBody = before + inserted + after
    commit({ ...draft, sections: draft.sections.map((item) => item.id === targetId ? { ...item, body: nextBody, citations: withCitations(item.citations, sources) } : item) })
    const position = start + inserted.length
    caretRef.current = { id: targetId, start: position, end: position }
    window.requestAnimationFrame(() => { const textarea = bodyRefs.current[targetId]; textarea?.focus(); textarea?.setSelectionRange(position, position) })
    const note = sources.length ? ' Check the source note.' : ''
    setNotice((dropAt !== null ? 'Added where you dropped it.' : 'Added at the cursor.') + note + (/\[[^\]]+\]/.test(fragment) ? ' Fill in the [placeholders].' : ''))
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
    setBusy(true); setError(''); setHelp(null); setCopiedSuggestion(null)
    try {
      const response = await requestWritingHelp({ heading: activeSection.heading, body: activeSection.body, question: question.trim() })
      setSuggestedForId(activeSection.id)
      setHelp(response)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The analysis service is unavailable.') }
    finally { setBusy(false) }
  }
  async function copySuggestion(text: string) {
    if (await copyText(text.trim())) {
      setCopiedSuggestion(text.trim()); setError('')
      setNotice('Copied. Paste it into a page; its source notes are added when you paste.')
    } else setError('Could not copy to the clipboard. Select the text and copy it by hand.')
  }
  function pasteIntoPage(event: ClipboardEvent<HTMLTextAreaElement>, sectionId: string) {
    const text = event.clipboardData.getData('text/plain').trim()
    const sentence = copiedSuggestion && text === copiedSuggestion ? help?.sentences.find((item) => item.text.trim() === text) : undefined
    if (!sentence) return
    event.preventDefault()
    rememberCaret(sectionId, event.currentTarget)
    insertText(sentence.text, sentence.evidence, sectionId)
  }
  async function copySampleSuggestions() {
    if (!sampleSet || !activeSection) return
    if (await copyText(suggestionsAsBullets(sampleSet))) {
      setCopiedFor(activeSection.id); setError('')
      setNotice('Suggestions copied. Click in a page and paste them where you need them.')
    } else setError('Could not copy to the clipboard. Select the suggestions and copy them by hand.')
  }
  function printDraft() {
    if (!draft.sections.some((section) => section.body.trim())) { setError('Add draft content before printing.'); return }
    window.print()
  }

  return <div className="draft-workspace">
    <div className="draft-topline">
      <div><span className="dashboard-eyebrow">PROJECT WORKSPACE / {projectName.toUpperCase()}</span><h1>Proposal draft</h1><p>Edit pages and review cited feedback.</p></div>
      <div className="draft-top-actions"><span className="draft-status">Draft · needs review</span><button type="button" className="outline-button" onClick={printDraft}><Printer size={15} /> Print / save PDF</button></div>
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
        <div className="draft-editor-toolbar"><span><FileText size={15} /> Editable document</span><span className="draft-history"><button type="button" onClick={undo} disabled={!historySize.undo} aria-label="Undo" title="Undo (⌘Z / Ctrl+Z)"><Undo2 size={15} /></button><button type="button" onClick={redo} disabled={!historySize.redo} aria-label="Redo" title="Redo (⇧⌘Z / Ctrl+Y)"><Redo2 size={15} /></button><span>Changes save in this browser</span></span></div>
        <div className="draft-page-stack">{draft.sections.map((section, index) => <section className={`draft-paper draft-page ${selectedId === section.id ? 'active' : ''}`} key={section.id} ref={(node) => { pageRefs.current[section.id] = node }} onClick={() => setSelectedId(section.id)} onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-grantguard-suggestion') || event.dataTransfer.types.includes('application/x-grantguard-page')) event.preventDefault() }} onDrop={(event) => {
          if (event.dataTransfer.types.includes('application/x-grantguard-page')) { event.preventDefault(); moveSection(event.dataTransfer.getData('application/x-grantguard-page'), section.id); return }
          if (event.dataTransfer.types.includes('application/x-grantguard-suggestion')) dropSuggestion(event, section.id)
        }}>
          <div className="draft-paper-section-head"><span>PAGE {String(index + 1).padStart(2, '0')} / {String(draft.sections.length).padStart(2, '0')}</span><div><button type="button" draggable onDragStart={(event) => { setDragId(section.id); event.dataTransfer.setData('application/x-grantguard-page', section.id) }} onDragEnd={() => setDragId(null)} aria-label={`Drag page ${index + 1}`} title="Drag page to reorder"><GripVertical size={15} /></button><button type="button" onClick={() => removeSection(section.id)} disabled={draft.sections.length === 1} aria-label={`Delete ${section.heading}`} title="Delete page"><Trash2 size={15} /></button></div></div>
          {index === 0 && <input className="draft-title-input" aria-label="Proposal title" value={draft.title} onChange={(event) => commit({ ...draft, title: event.target.value }, 'title')} placeholder="Proposal title" />}
          <input className="draft-page-heading" aria-label={`Heading for page ${index + 1}`} value={section.heading} onChange={(event) => editSection(section.id, 'heading', event.target.value)} placeholder="Page heading" />
          <textarea ref={(node) => { bodyRefs.current[section.id] = node }} aria-label={`Body for ${section.heading}`} value={section.body} onChange={(event) => editSection(section.id, 'body', event.target.value)} onSelect={(event) => rememberCaret(section.id, event.currentTarget)} onKeyUp={(event) => rememberCaret(section.id, event.currentTarget)} onPaste={(event) => pasteIntoPage(event, section.id)} onClick={(event) => rememberCaret(section.id, event.currentTarget)} placeholder="Write here, or choose a template to begin…" rows={Math.max(10, Math.min(30, section.body.split('\n').length + 5))} />
          {section.citations.length > 0 && <div className="draft-citations"><small>SOURCE NOTES</small>{section.citations.map((citation, citationIndex) => <button type="button" key={`${citation.documentId}-${citation.page ?? 0}-${citationIndex}`} disabled={!onOpenSource} onClick={() => onOpenSource?.(citation.documentId, citation.page)}>{documentById[citation.documentId]?.shortTitle ?? `Document ${citation.documentId}`}{citation.page ? ` · page ${citation.page}` : ''}</button>)}</div>}
        </section>)}</div>
      </div>
      <aside className="draft-right" aria-label="Analysis and review">
        <div className="draft-panel-title"><strong>Review desk</strong><small>{analysisConnected ? 'Analysis connected' : 'Source review'}</small></div>
        <div className="draft-review-scroll">
          {proposal?.checklist.length ? <div className="draft-review-block"><span className="dashboard-eyebrow">CALL REQUIREMENTS</span>{proposal.checklist.slice(0, 8).map((row) => <button type="button" className="draft-review-item" key={row.id} disabled={!row.evidence.length} onClick={() => openChecklistRow(row)} title={row.reason}><strong>{row.requirement}</strong><small><span className={`draft-check-status ${row.status}`}>{checklistLabel[row.status]}</span> {row.evidence.length} source {row.evidence.length === 1 ? 'reference' : 'references'} <ArrowRight size={12} /></small></button>)}</div>
            : requirements.length > 0 && <div className="draft-review-block"><span className="dashboard-eyebrow">REQUIREMENTS</span>{requirements.slice(0, 5).map((item) => <button type="button" className="draft-review-item" key={item.id} onClick={() => onOpenRequirement?.(item)}><strong>{item.title}</strong><small>{item.evidence.length} source {item.evidence.length === 1 ? 'reference' : 'references'} <ArrowRight size={12} /></small></button>)}</div>}
          <div className="draft-review-block"><span className="dashboard-eyebrow">ISSUES TO REVIEW</span>{deskFindings.length ? deskFindings.slice(0, 5).map((item) => <button type="button" className="draft-review-item" key={item.id} onClick={() => onOpenIssue?.(item)}><strong>{item.title}</strong><small>{item.state.replaceAll('_', ' ')}{item.resolver ? ` · who decides: ${item.resolver === 'gac' ? 'GAC' : 'Water Care staff'}` : ''} <ArrowRight size={12} /></small></button>) : <p>No cited issues loaded for this project.</p>}</div>
          {sampleSet && <div className="draft-review-block draft-samples"><span className="dashboard-eyebrow">SUGGESTIONS FOR THIS PAGE <em className="draft-sample-tag">Sample data</em></span><small>For: {sampleSet.heading}</small>
            <ul>{sampleSet.suggestions.map((item, index) => <li key={`${index}-${item.text}`}><p>{item.text}</p><button type="button" disabled={!onOpenSource} onClick={() => onOpenSource?.(item.source.documentId, item.source.page)}>{documentById[item.source.documentId]?.shortTitle ?? `Document ${item.source.documentId}`} · page {item.source.page} <ArrowRight size={12} /></button></li>)}</ul>
            <button type="button" className="draft-ask" onClick={() => void copySampleSuggestions()}>{copiedFor === activeSection?.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy suggestions</>}</button>
          </div>}
          <div className="draft-review-block"><span className="dashboard-eyebrow"><Sparkles size={13} /> AI WRITING HELP</span><p>Ask about the selected page. You get cited tips and, when it fits, sentences you can copy or drag into the page.</p><textarea aria-label="Writing help request" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Help me describe our cost share" rows={3} /><button type="button" className="draft-ask" onClick={() => void requestSuggestion()} disabled={!analysisConnected || busy || !question.trim() || !activeSection}>{busy ? 'Checking…' : 'Get feedback'} <ArrowRight size={14} /></button>{!analysisConnected && <small>Connect the analysis service for cited feedback.</small>}
            {help && <div className="draft-answer">
              <strong>{help.tips.length} tip{help.tips.length === 1 ? '' : 's'} · {help.sentences.length} sentence{help.sentences.length === 1 ? '' : 's'} you can use</strong>
              {suggestedForId && <small>For page: {draft.sections.find((section) => section.id === suggestedForId)?.heading ?? 'Removed page'}</small>}
              {help.tips.length > 0 && <div className="draft-help-group"><span className="dashboard-eyebrow">TIPS</span>{help.tips.map((tip, index) => <div className="draft-help-tip" key={`tip-${index}`}><p>{tip.text}</p><WritingSources item={tip} onOpenSource={onOpenSource} /></div>)}</div>}
              {help.sentences.length > 0 && <div className="draft-help-group"><span className="dashboard-eyebrow">SENTENCES YOU CAN USE</span><small>Copy or drag into a page, then edit. Replace each [placeholder] with your own details.</small>
                {help.sentences.map((sentence, index) => <div className="draft-answer-item" key={`sentence-${index}`}><p>{withPlaceholders(sentence.text)}</p><WritingSources item={sentence} onOpenSource={onOpenSource} /><div className="draft-answer-actions"><button type="button" onClick={() => void copySuggestion(sentence.text)}>{copiedSuggestion === sentence.text.trim() ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}</button><button type="button" className="draft-suggestion-drag" draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-grantguard-suggestion', String(index)); event.dataTransfer.effectAllowed = 'copy' }} aria-label={`Drag sentence ${index + 1} to a page`} title="Drag to a page"><GripVertical size={14} /></button></div></div>)}
              </div>}
              {help.missingInformation.length > 0 && <div className="draft-help-group"><span className="dashboard-eyebrow">YOU NEED TO SUPPLY</span><ul className="draft-help-missing">{help.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              {help.removed.length > 0 && <small className="draft-help-removed" title={help.removed.join('\n')}>{help.removed.length} item{help.removed.length === 1 ? ' was' : 's were'} left out by the source checks (unverified quote, unsupported figure, or a compliance claim). Hover for details.</small>}
            </div>}
          </div>
        </div>
      </aside>
    </div>
    <article className="draft-print" aria-hidden="true"><h1>{draft.title}</h1>{draft.sections.map((section) => <section key={section.id}><h2>{section.heading}</h2><p>{section.body}</p>{section.citations.length > 0 && <small>Source notes: {section.citations.map((citation) => `${documentById[citation.documentId]?.shortTitle ?? `Document ${citation.documentId}`}${citation.page ? `, page ${citation.page}` : ''}`).join('; ')}</small>}</section>)}</article>
  </div>
}
