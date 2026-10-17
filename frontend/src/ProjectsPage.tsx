import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, FileText, FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { BrandMark } from './Brand'
import { ThemeToggle } from './components/ThemeToggle'
import { DraftWorkspace } from './components/DraftWorkspace'
import { ProjectDocuments } from './components/ProjectDocuments'
import { loadDraft, removeDraft } from './draft'
import { deleteProjectDocuments, listLocalDocuments } from './localDocuments'
import { createLocalProject, loadLocalProjects, saveLocalProjects, type LocalProject } from './projects'
import type { Theme } from './theme'

type Props = { projectId?: string; projectSection?: 'intake' | 'draft'; onHome: () => void; onOpenDemo: () => void; onOpenProject: (id: string, section?: 'intake' | 'draft') => void; onProjects: () => void; theme: Theme; onToggleTheme: () => void }

export function ProjectsPage({ projectId, projectSection, onHome, onOpenDemo, onOpenProject, onProjects, theme, onToggleTheme }: Props) {
  const [projects, setProjects] = useState<LocalProject[]>(loadLocalProjects)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [error, setError] = useState('')
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({})
  const project = projects.find((item) => item.id === projectId)

  useEffect(() => {
    let active = true
    Promise.all(projects.map(async (item) => [item.id, (await listLocalDocuments(item.id)).length] as const))
      .then((counts) => { if (active) setDocumentCounts(Object.fromEntries(counts)) })
      .catch(() => { /* Draft counts remain as a local fallback. */ })
    return () => { active = false }
  }, [projects, projectId])

  function addProject(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) { setError('Enter a project name.'); return }
    if (projects.some((item) => item.name.toLowerCase() === name.trim().toLowerCase())) { setError('A project with this name already exists in this browser.'); return }
    try {
      const next = createLocalProject(name, organization)
      setProjects(saveLocalProjects([...projects, next]))
      setName('')
      setOrganization('')
      setError('')
      setCreating(false)
      onOpenProject(next.id)
    } catch { setError('Could not save this project. Check the name or browser storage.') }
  }

  async function removeProject() {
    if (!project) return
    if (!window.confirm(`Remove “${project.name}” from this browser?`)) return
    try {
      setProjects(saveLocalProjects(projects.filter((item) => item.id !== project.id)))
      removeDraft(project.id)
      await deleteProjectDocuments(project.id)
      onProjects()
    } catch { setError('Could not remove this project from browser storage.') }
  }

  return <div className="projects-page">
    <header className="projects-topbar"><button type="button" className="projects-brand" onClick={onHome}><BrandMark /> GrantGuard</button><div className="projects-topbar-actions"><span>Personal workspace <small>Browser preview</small></span><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div></header>
    <main className={`projects-main ${projectId && project ? 'projects-main-draft' : ''}`}>
      {projectId ? project ? <>
        <button className="projects-back" type="button" onClick={onProjects}><ArrowLeft size={16} /> All projects</button>
        <div className="projects-detail-heading"><div><span className="dashboard-eyebrow">PROJECT WORKSPACE</span><h1>{project.name}</h1><p>{project.organization || 'Organization not specified'}</p></div><button className="projects-delete" type="button" onClick={() => void removeProject()}><Trash2 size={16} /> Remove project</button></div>
        <div className="projects-workspace-tabs"><button type="button" className={projectSection === 'draft' ? '' : 'active'} onClick={() => onOpenProject(project.id, 'intake')}>Project documents</button><button type="button" className={projectSection === 'draft' ? 'active' : ''} onClick={() => onOpenProject(project.id, 'draft')}>Proposal draft</button></div>
        {projectSection === 'draft' ? <DraftWorkspace projectId={project.id} projectName={project.name} onOpenIntake={() => onOpenProject(project.id, 'intake')} /> : <ProjectDocuments projectId={project.id} projectName={project.name} onGoDraft={() => onOpenProject(project.id, 'draft')} />}
      </> : <div className="project-empty"><h1>Project not found</h1><p>This project may have been removed or was created in a different browser.</p><button className="solid-button" type="button" onClick={onProjects}>All projects <ArrowRight size={16} /></button></div> : <>
        <div className="projects-heading"><div><span className="dashboard-eyebrow">YOUR WORKSPACE</span><h1>Projects</h1><p>Keep each grant application and its evidence in its own place.</p></div><button className="solid-button" type="button" onClick={() => { setCreating(true); setError('') }}><Plus size={17} /> New project</button></div>
        <div className="projects-note"><FolderOpen size={19} /><span>Open the demo case to edit a proposal beside cited analysis, or create a separate project with a local draft and file intake.</span></div>
        <div className="projects-grid">
          <button className="project-card project-card-demo" type="button" onClick={onOpenDemo}><span className="project-card-top"><span className="project-card-icon"><FileText size={21} /></span><span className="project-card-badge">DEMO CASE</span></span><strong>Taps for Rights</strong><span>Water Care · synthetic challenge case</span><div><span>7 source files</span><span>Evidence workspace ready</span></div><span className="project-card-open">Open workspace <ArrowUpRight size={16} /></span></button>
          {projects.map((item) => { const sourceCount = documentCounts[item.id] ?? loadDraft(item.id, item.name).sources.length; return <button className="project-card" type="button" key={item.id} onClick={() => onOpenProject(item.id)}><span className="project-card-top"><span className="project-card-icon"><FolderOpen size={21} /></span><span className="project-card-badge muted">{sourceCount ? 'IN PROGRESS' : 'SETUP'}</span></span><strong>{item.name}</strong><span>{item.organization || 'Organization not specified'}</span><div><span>{sourceCount} uploaded {sourceCount === 1 ? 'file' : 'files'}</span><span>Browser local</span></div><span className="project-card-open">Open project <ArrowUpRight size={16} /></span></button> })}
          <button className="project-card project-card-add" type="button" onClick={() => { setCreating(true); setError('') }}><Plus size={23} /><strong>Add another project</strong><span>Start a separate grant folder</span></button>
        </div>
      </>}
    </main>
    {creating && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false) }}><form className="project-dialog" onSubmit={addProject}><div className="dialog-header"><div><span className="dashboard-eyebrow">NEW PROJECT</span><h2>Create a project folder</h2></div><button type="button" className="icon-button" onClick={() => setCreating(false)} aria-label="Close"><X size={18} /></button></div><p>Keep this grant separate from the demo case. This saves a folder in your browser; documents can be connected later.</p><label>Project name<input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Community Water Access" /></label><label>Organization <small>optional</small><input maxLength={80} value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="e.g. Water Care" /></label>{error && <div className="inline-error" role="alert">{error}</div>}<div className="project-dialog-actions"><button className="outline-button" type="button" onClick={() => setCreating(false)}>Cancel</button><button className="solid-button" type="submit">Create project <ArrowRight size={16} /></button></div></form></div>}
  </div>
}
