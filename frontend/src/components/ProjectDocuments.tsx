import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, FileText, FolderOpen, Trash2, Upload } from 'lucide-react'
import { documents } from '../documents'
import { loadDraft, saveDraft } from '../draft'
import { addLocalDocument, deleteLocalDocument, listLocalDocuments, type DocumentCategory, type LocalDocument } from '../localDocuments'

type Props = { projectId: string; projectName: string; onGoDraft: () => void; onOpenBundled?: (id: string) => void }
const categories: DocumentCategory[] = ['Funding call', 'Agreement', 'Proposal', 'Report', 'Framework', 'Budget', 'Other']

export function ProjectDocuments({ projectId, projectName, onGoDraft, onOpenBundled }: Props) {
  const [uploaded, setUploaded] = useState<LocalDocument[]>([])
  const [category, setCategory] = useState<DocumentCategory>('Other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { let active = true; listLocalDocuments(projectId).then((items) => { if (active) setUploaded(items) }).catch(() => { if (active) setError('Could not open this browser’s document store.') }); return () => { active = false } }, [projectId])

  async function upload(files: FileList | File[]) {
    if (!files.length) return
    setBusy(true); setError(''); setNotice('')
    let added = 0
    try {
      for (const file of Array.from(files)) { await addLocalDocument(projectId, file, category); added++ }
      setUploaded(await listLocalDocuments(projectId))
      setNotice(`${added} ${added === 1 ? 'document' : 'documents'} saved in this browser.`)
    } catch (cause) {
      setUploaded(await listLocalDocuments(projectId))
      setError(`${added ? `${added} saved. ` : ''}${cause instanceof Error ? cause.message : 'Could not save a document.'}`)
    } finally { setBusy(false); setDragging(false); if (inputRef.current) inputRef.current.value = '' }
  }

  async function remove(id: string) {
    try { await deleteLocalDocument(id); setUploaded(await listLocalDocuments(projectId)); setNotice('Document removed from this browser.') }
    catch { setError('Could not remove the document.') }
  }

  function download(document: LocalDocument) {
    const url = URL.createObjectURL(document.blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = document.name
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  function useInDraft(document: LocalDocument) {
    if (!document.extractedText.trim()) return
    try {
      const draft = loadDraft(projectId, projectName)
      const starter = draft.sections.length === 1 && draft.sections[0].heading === 'Project overview' && !draft.sections[0].body.trim() ? [] : draft.sections
      saveDraft(projectId, { ...draft, approvedAt: null, sections: [...starter, { id: crypto.randomUUID(), heading: document.name.replace(/\.[^.]+$/, ''), body: document.extractedText, citations: [] }], sources: [...draft.sources, { id: document.id, name: document.name, kind: document.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text', addedAt: document.addedAt, ...(document.pageCount ? { pages: document.pageCount } : {}) }] })
      onGoDraft()
    } catch { setError('Could not add this document to the proposal draft.') }
  }

  return <div className="project-documents">
    <div className="documents-heading"><div><span className="dashboard-eyebrow">PROJECT INTAKE / {projectName.toUpperCase()}</span><h1>Project documents</h1><p>Keep source files together before reviewing requirements and drafting the proposal.</p></div><button type="button" className="outline-button" onClick={onGoDraft}>Open proposal draft <ArrowRight size={15} /></button></div>
    {(error || notice) && <div className={error ? 'inline-error' : 'draft-notice'} role={error ? 'alert' : 'status'}>{error || notice}</div>}
    <div className="documents-grid"><section className="documents-main"><div className={`documents-drop ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files) }}><Upload size={24} /><h2>Upload source documents</h2><p>Drop files here or select them. Originals and extracted text stay in this browser until a project upload service is connected.</p><div><label>Document type<select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" className="solid-button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? 'Reading files…' : 'Choose files'}</button></div><input ref={inputRef} hidden type="file" multiple accept=".pdf,.txt,.md,.docx,.xlsx,application/pdf,text/plain" onChange={(event) => void upload(event.target.files ?? [])} /><small>PDF, TXT, MD, DOCX, XLSX · 10 MB each</small></div><div className="documents-list"><div className="documents-list-head"><strong>Uploaded files</strong><span>{uploaded.length}</span></div>{uploaded.length ? uploaded.map((document) => <article key={document.id}><span className="documents-file-icon"><FileText size={18} /></span><div><strong>{document.name}</strong><small>{document.category} · {(document.size / 1024).toFixed(0)} KB · {document.extractedText.trim() ? 'Text available for editing' : 'Stored; extraction or OCR needed'}</small><em>Local document · not included in AI analysis yet</em></div><div className="documents-file-actions"><button type="button" onClick={() => download(document)}>Download</button><button type="button" disabled={!document.extractedText.trim()} onClick={() => useInDraft(document)}>Use in draft</button><button type="button" onClick={() => void remove(document.id)} aria-label={`Remove ${document.name}`}><Trash2 size={15} /></button></div></article>) : <div className="documents-empty"><FolderOpen size={23} /><p>No project files uploaded yet.</p></div>}</div></section><aside className="documents-side"><h2>Analysis scope</h2><p>Uploaded files are saved locally for review and drafting. They will need a project-scoped backend upload route before AI can extract requirements or generate cited findings from them.</p>{projectId === 'taps-for-rights' && <><h3>Supplied demo sources</h3><p>The connected demo analysis uses these original challenge documents.</p><div className="documents-bundled">{documents.map((document) => <button type="button" key={document.id} onClick={() => onOpenBundled?.(document.id)} disabled={!onOpenBundled}><span><strong>{document.shortTitle}</strong><small>{document.id} · {document.format}</small></span><ArrowUpRight size={15} /></button>)}</div></>}</aside></div>
  </div>
}
