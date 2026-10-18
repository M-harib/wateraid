import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, FileText, FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { BrandMark } from './Brand'
import { ThemeToggle } from './components/ThemeToggle'
import { DraftWorkspace } from './components/DraftWorkspace'
import { ProjectDocuments } from './components/ProjectDocuments'
import { removeDraft } from './draft'
import { deleteProjectDocuments } from './localDocuments'
import { demoProjectId, loadLocalProjects, saveLocalProjects, type LocalProject } from './projects'
import { createProject, loadProjects, type ProjectSummary } from './api'
import type { Theme } from './theme'

type Props = { projectId?: string; projectSection?: 'intake' | 'draft'; onHome: () => void; onOpenDemo: () => void; onOpenProject: (id: string, section?: 'intake' | 'draft') => void; onProjects: () => void; theme: Theme; onToggleTheme: () => void }

export function ProjectsPage({ projectId, projectSection, onHome, onOpenDemo, onOpenProject, onProjects, theme, onToggleTheme }: Props) {
  const [projects, setProjects] = useState<LocalProject[]>(loadLocalProjects)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [error, setError] = useState('')
  const [backendProjects, setBackendProjects] = useState<ProjectSummary[]>([])
  const project = projects.find((item) => item.id === projectId)

  useEffect(() => {
    let active = true
    loadProjects().then((list) => { if (active) setBackendProjects(list) }).catch(() => { /* list stays empty */ })
    return () => { active = false }
  }, [])

  function openWorkspace(id: string) {
    try { window.localStorage.setItem('grantguard.project', id) } catch { /* selection just won't persist */ }
    onOpenDemo()
  }

  async function addProject(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) { setError('Enter a project name.'); return }
    try {
      const created = await createProject(name.trim())
      setName('')
      setOrganization('')
      setError('')
      setCreating(false)
      openWorkspace(created.projectId)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create this project.') }
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
        <div className="projects-note"><FolderOpen size={19} /><span>Each project keeps its own uploaded documents and evidence workspace. Open one to work on it.</span></div>
        <div className="projects-grid">
          {backendProjects.map((item) => { const demo = item.projectId === demoProjectId; return <button className={`project-card ${demo ? 'project-card-demo' : ''}`} type="button" key={item.projectId} onClick={() => openWorkspace(item.projectId)}><span className="project-card-top"><span className="project-card-icon">{demo ? <FileText size={21} /> : <FolderOpen size={21} />}</span><span className={`project-card-badge ${demo ? '' : 'muted'}`}>{demo ? 'DEMO CASE' : `${item.documentCount} ${item.documentCount === 1 ? 'DOC' : 'DOCS'}`}</span></span><strong>{item.name}</strong><span>{item.documentCount} source {item.documentCount === 1 ? 'file' : 'files'}</span><div><span>Evidence workspace</span><span>{item.ready ? 'Ready' : 'In progress'}</span></div><span className="project-card-open">Open workspace <ArrowUpRight size={16} /></span></button> })}
          <button className="project-card project-card-add" type="button" onClick={() => { setCreating(true); setError('') }}><Plus size={23} /><strong>Add another project</strong><span>Start a separate grant folder</span></button>
        </div>
      </>}
    </main>
    {creating && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false) }}><form className="project-dialog" onSubmit={addProject}><div className="dialog-header"><div><span className="dashboard-eyebrow">NEW PROJECT</span><h2>Create a project folder</h2></div><button type="button" className="icon-button" onClick={() => setCreating(false)} aria-label="Close"><X size={18} /></button></div><p>Keep this grant separate from the demo case. This saves a folder in your browser; documents can be connected later.</p><label>Project name<input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Community Water Access" /></label><label>Organization <small>optional</small><input maxLength={80} value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="e.g. Water Care" /></label>{error && <div className="inline-error" role="alert">{error}</div>}<div className="project-dialog-actions"><button className="outline-button" type="button" onClick={() => setCreating(false)}>Cancel</button><button className="solid-button" type="submit">Create project <ArrowRight size={16} /></button></div></form></div>}
  </div>
}
