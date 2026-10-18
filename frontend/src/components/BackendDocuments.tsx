import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronRight, FileSpreadsheet, FileText, Folder, FolderOpen, Loader, Plus, Trash2, Upload } from 'lucide-react'
import {
  deleteProjectDocument,
  loadProjectDocuments,
  projectDocumentFileUrl,
  uploadProjectDocuments,
  type ProjectDocument,
  type ProjectSummary,
} from '../api'

type Props = {
  projectId: string
  projectName: string
  projects: ProjectSummary[]
  onSelectProject: (id: string) => void
  onNewProject: () => void
  connected: boolean
}

const ACCEPT = '.pdf,.xlsx,.xls,.csv'

function StatusBadge({ doc }: { doc: ProjectDocument }) {
  if (doc.status === 'ready') return <span className="doc-badge ready"><CheckCircle2 size={13} /> Ready · {doc.unit_count} units</span>
  if (doc.status === 'failed') return <span className="doc-badge failed"><AlertCircle size={13} /> {doc.error ?? 'Failed'}</span>
  return <span className="doc-badge busy"><Loader size={13} className="spin" /> {doc.status === 'queued' ? 'Queued' : 'Ingesting…'}</span>
}

export function BackendDocuments({ projectId, projectName, projects, onSelectProject, onNewProject, connected }: Props) {
  const [docs, setDocs] = useState<ProjectDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!connected) return
    let active = true
    setDocs([]); setError(''); setNotice('')
    loadProjectDocuments(projectId)
      .then((r) => { if (active) setDocs(r.documents) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load documents.') })
    return () => { active = false }
  }, [connected, projectId])

  // poll while any document is still queued/ingesting
  useEffect(() => {
    if (!connected || !docs.some((d) => d.status === 'queued' || d.status === 'ingesting')) return
    const timer = window.setTimeout(async () => {
      try { setDocs((await loadProjectDocuments(projectId)).documents) } catch { /* retry next tick */ }
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [docs, connected, projectId])

  async function onFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (!files.length) return
    setUploading(true); setError(''); setNotice('')
    try {
      setDocs((await uploadProjectDocuments(projectId, files)).documents)
      setNotice(`${files.length} file${files.length === 1 ? '' : 's'} uploaded — ingesting in the background.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.') }
    finally { setUploading(false); setDragging(false); if (inputRef.current) inputRef.current.value = '' }
  }

  async function remove(docId: string) {
    try {
      await deleteProjectDocument(projectId, docId)
      setDocs((await loadProjectDocuments(projectId)).documents)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the document.') }
  }

  return <div className="project-documents">
    <nav className="documents-breadcrumb">
      <span>Projects</span><ChevronRight size={15} /><strong>{projectName}</strong>
      <button type="button" onClick={onNewProject}><Plus size={15} /> New project</button>
    </nav>
    {!connected && <div className="inline-error" role="alert">Connect the analysis service (set VITE_API_BASE_URL) to upload documents.</div>}
    {(error || notice) && <div className={error ? 'inline-error' : 'draft-notice'} role={error ? 'alert' : 'status'}>{error || notice}</div>}

    <div className="documents-browser">
      <aside className="documents-folders">
        <span className="documents-folders-head">PROJECTS</span>
        {projects.map((item) => {
          const active = item.projectId === projectId
          return <button type="button" key={item.projectId} className={`documents-folder ${active ? 'active' : ''}`} onClick={() => onSelectProject(item.projectId)}>
            <span className="documents-folder-icon">{active ? <FolderOpen size={18} /> : <Folder size={18} />}</span>
            <span><strong>{item.name}</strong><small>{item.documentCount} document{item.documentCount === 1 ? '' : 's'}</small></span>
          </button>
        })}
        {projects.length === 0 && <p className="no-results">No projects yet.</p>}
      </aside>

      <section className="documents-pane"
        onDragOver={(e) => { e.preventDefault(); if (connected) setDragging(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); if (connected) void onFiles(e.dataTransfer.files) }}>
        <div className="documents-pane-head">
          <div><h2>{projectName}</h2><small>{docs.length} document{docs.length === 1 ? '' : 's'}</small></div>
          <button type="button" className="solid-button" disabled={!connected || uploading} onClick={() => inputRef.current?.click()}><Upload size={16} /> {uploading ? 'Uploading…' : 'Add documents'}</button>
        </div>
        <input ref={inputRef} hidden type="file" multiple accept={ACCEPT} onChange={(e) => void onFiles(e.target.files ?? [])} />

        {docs.length > 0
          ? <div className="documents-list">{docs.map((doc) => <article key={doc.doc_id}>
              <span className="documents-file-icon">{doc.kind === 'pdf' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}</span>
              <div><strong>{doc.filename}</strong><small><StatusBadge doc={doc} /></small></div>
              <div className="documents-file-actions">
                {doc.status === 'ready' && <a href={projectDocumentFileUrl(projectId, doc.doc_id)} target="_blank" rel="noreferrer">Open</a>}
                <button type="button" onClick={() => void remove(doc.doc_id)} aria-label={`Remove ${doc.filename}`}><Trash2 size={15} /></button>
              </div>
            </article>)}</div>
          : <div className={`documents-empty-drop ${dragging ? 'dragging' : ''}`}><Upload size={24} /><p>Drop PDF, XLSX/XLS, or CSV files here, or use <strong>Add documents</strong>.</p></div>}
        {dragging && docs.length > 0 && <div className="documents-drop-hint">Drop to upload to {projectName}</div>}
      </section>
    </div>
  </div>
}
