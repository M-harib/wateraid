import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, ArrowUpRight, CheckCircle2, FileSpreadsheet, FileText, Loader, Trash2, Upload } from 'lucide-react'
import {
  askProjectQuestion,
  deleteProjectDocument,
  loadProjectDocuments,
  projectDocumentFileUrl,
  uploadProjectDocuments,
  type AskAnswer,
  type ProjectDocument,
} from '../api'

type Props = { projectId: string; projectName: string; connected: boolean }

const ACCEPT = '.pdf,.xlsx,.xls,.csv'

function StatusBadge({ doc }: { doc: ProjectDocument }) {
  if (doc.status === 'ready') return <span className="doc-badge ready"><CheckCircle2 size={13} /> Ready · {doc.unit_count} units</span>
  if (doc.status === 'failed') return <span className="doc-badge failed"><AlertCircle size={13} /> {doc.error ?? 'Failed'}</span>
  return <span className="doc-badge busy"><Loader size={13} className="spin" /> {doc.status === 'queued' ? 'Queued' : 'Ingesting…'}</span>
}

export function BackendDocuments({ projectId, projectName, connected }: Props) {
  const [docs, setDocs] = useState<ProjectDocument[]>([])
  const [ready, setReady] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!connected) return
    let active = true
    loadProjectDocuments(projectId)
      .then((r) => { if (active) { setDocs(r.documents); setReady(r.ready) } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load documents.') })
    return () => { active = false }
  }, [connected, projectId])

  // poll while any document is still queued/ingesting
  useEffect(() => {
    if (!connected || !docs.some((d) => d.status === 'queued' || d.status === 'ingesting')) return
    const timer = window.setTimeout(async () => {
      try { const r = await loadProjectDocuments(projectId); setDocs(r.documents); setReady(r.ready) } catch { /* retry next tick */ }
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [docs, connected, projectId])

  async function onFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (!files.length) return
    setUploading(true); setError(''); setNotice('')
    try {
      const r = await uploadProjectDocuments(projectId, files)
      setDocs(r.documents); setReady(r.ready)
      setNotice(`${files.length} file${files.length === 1 ? '' : 's'} uploaded — ingesting in the background.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.') }
    finally { setUploading(false); setDragging(false); if (inputRef.current) inputRef.current.value = '' }
  }

  async function remove(docId: string) {
    try { await deleteProjectDocument(projectId, docId); const r = await loadProjectDocuments(projectId); setDocs(r.documents); setReady(r.ready) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the document.') }
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault()
    if (!question.trim()) return
    setAsking(true); setAskError(''); setAnswer(null)
    try { setAnswer(await askProjectQuestion(projectId, question.trim())) }
    catch (e) { setAskError(e instanceof Error ? e.message : 'The analysis service is unavailable.') }
    finally { setAsking(false) }
  }

  const nameFor = (id: string) => docs.find((d) => d.doc_id === id)?.filename ?? id

  return <div className="project-documents">
    <div className="documents-heading"><div><span className="dashboard-eyebrow">PROJECT UPLOAD / {projectName.toUpperCase()}</span><h1>Upload &amp; analyze documents</h1><p>Upload PDFs, spreadsheets, or CSVs. They are ingested in the background; once ready you can ask questions grounded in them.</p></div></div>
    {!connected && <div className="inline-error" role="alert">Connect the analysis service (set VITE_API_BASE_URL) to upload and analyze documents.</div>}
    {(error || notice) && <div className={error ? 'inline-error' : 'draft-notice'} role={error ? 'alert' : 'status'}>{error || notice}</div>}

    <div className={`documents-drop ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (connected) setDragging(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={(e) => { e.preventDefault(); if (connected) void onFiles(e.dataTransfer.files) }}>
      <Upload size={24} />
      <h2>Upload source documents</h2>
      <p>Drop files here or choose them. PDF, XLSX/XLS, CSV.</p>
      <button type="button" className="solid-button" disabled={!connected || uploading} onClick={() => inputRef.current?.click()}>{uploading ? 'Uploading…' : 'Choose files'}</button>
      <input ref={inputRef} hidden type="file" multiple accept={ACCEPT} onChange={(e) => void onFiles(e.target.files ?? [])} />
    </div>

    {docs.length > 0 && <div className="documents-list"><div className="documents-list-head"><strong>Documents</strong><span>{docs.length}</span></div>
      {docs.map((doc) => <article key={doc.doc_id}>
        <span className="documents-file-icon">{doc.kind === 'pdf' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}</span>
        <div><strong>{doc.filename}</strong><small><StatusBadge doc={doc} /></small></div>
        <div className="documents-file-actions">
          {doc.status === 'ready' && <a href={projectDocumentFileUrl(projectId, doc.doc_id)} target="_blank" rel="noreferrer">Open</a>}
          <button type="button" onClick={() => void remove(doc.doc_id)} aria-label={`Remove ${doc.filename}`}><Trash2 size={15} /></button>
        </div>
      </article>)}
    </div>}

    <form className="ask-composer" onSubmit={ask} style={{ marginTop: 22 }}>
      <label htmlFor="workspace-upload-question">Ask these documents</label>
      <textarea id="workspace-upload-question" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={ready ? 'What do these documents say about…?' : 'Upload at least one document and wait for it to be ready.'} />
      <div><span>{ready ? 'Answers are grounded in your uploaded documents with cited excerpts.' : 'Waiting for a ready document…'}</span>
        <button className="solid-button" type="submit" disabled={!connected || !ready || !question.trim() || asking}>{asking ? 'Checking sources…' : 'Ask'} <ArrowRight size={15} /></button></div>
    </form>
    {askError && <div className="inline-error" role="alert">{askError}</div>}
    {answer && <div className="answer-panel"><span className="dashboard-eyebrow">{answer.status.replaceAll('_', ' ')} · {answer.confidence.level.toUpperCase()} CONFIDENCE</span>
      <p>{answer.answer}</p>
      {answer.evidence.length > 0 && <div className="answer-sources">{answer.evidence.map((item, index) => <a key={`${item.documentId}-${index}`} href={projectDocumentFileUrl(projectId, item.documentId)} target="_blank" rel="noreferrer"><span><strong>{nameFor(item.documentId)}</strong>{item.excerpt && <em>“{item.excerpt}”</em>}</span><ArrowUpRight size={15} /></a>)}</div>}
    </div>}
  </div>
}
