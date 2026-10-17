import { useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, FileText, FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { BrandMark } from './Brand'
import { createLocalProject, loadLocalProjects, saveLocalProjects, type LocalProject } from './projects'

type Props = { projectId?: string; onHome: () => void; onOpenDemo: () => void; onOpenProject: (id: string) => void; onProjects: () => void }

export function ProjectsPage({ projectId, onHome, onOpenDemo, onOpenProject, onProjects }: Props) {
  const [projects, setProjects] = useState<LocalProject[]>(loadLocalProjects)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [error, setError] = useState('')
  const project = projects.find((item) => item.id === projectId)

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

  function removeProject() {
    if (!project) return
    if (!window.confirm(`Remove “${project.name}” from this browser?`)) return
    try {
      setProjects(saveLocalProjects(projects.filter((item) => item.id !== project.id)))
      onProjects()
    } catch { setError('Could not remove this project from browser storage.') }
  }

  return <div className="projects-page">
    <header className="projects-topbar"><button type="button" className="projects-brand" onClick={onHome}><BrandMark /> GrantGuard</button><span>Personal workspace <small>Browser preview</small></span></header>
    <main className="projects-main">
      {projectId ? project ? <>
        <button className="projects-back" type="button" onClick={onProjects}><ArrowLeft size={16} /> All projects</button>
        <div className="projects-detail-heading"><div><span className="dashboard-eyebrow">PROJECT SETUP</span><h1>{project.name}</h1><p>{project.organization || 'Organization not specified'}</p></div><button className="projects-delete" type="button" onClick={removeProject}><Trash2 size={16} /> Remove project</button></div>
        <div className="project-empty"><span className="project-empty-icon"><FolderOpen size={26} /></span><h2>This project is ready to organize.</h2><p>It has no documents, findings, or AI answers. Project-specific uploads and analysis need the team’s backend before they can be used here.</p><div><strong>Project folder</strong><span>Documents · 0</span><span>Issues · 0</span><span>Reviews · 0</span></div><small>Saved in this browser only. Account sync is planned for a later phase.</small></div>
      </> : <div className="project-empty"><h1>Project not found</h1><p>This project may have been removed or was created in a different browser.</p><button className="solid-button" type="button" onClick={onProjects}>All projects <ArrowRight size={16} /></button></div> : <>
        <div className="projects-heading"><div><span className="dashboard-eyebrow">YOUR WORKSPACE</span><h1>Projects</h1><p>Keep each grant application and its evidence in its own place.</p></div><button className="solid-button" type="button" onClick={() => { setCreating(true); setError('') }}><Plus size={17} /> New project</button></div>
        <div className="projects-note"><FolderOpen size={19} /><span>One demo case is ready to inspect. New projects are private browser-local folders until uploads and account sync are built.</span></div>
        <div className="projects-grid">
          <button className="project-card project-card-demo" type="button" onClick={onOpenDemo}><span className="project-card-top"><span className="project-card-icon"><FileText size={21} /></span><span className="project-card-badge">DEMO CASE</span></span><strong>Taps for Rights</strong><span>Water Care · synthetic challenge case</span><div><span>7 source files</span><span>Evidence workspace ready</span></div><span className="project-card-open">Open workspace <ArrowUpRight size={16} /></span></button>
          {projects.map((item) => <button className="project-card" type="button" key={item.id} onClick={() => onOpenProject(item.id)}><span className="project-card-top"><span className="project-card-icon"><FolderOpen size={21} /></span><span className="project-card-badge muted">SETUP</span></span><strong>{item.name}</strong><span>{item.organization || 'Organization not specified'}</span><div><span>0 source files</span><span>Browser local</span></div><span className="project-card-open">Open project <ArrowUpRight size={16} /></span></button>)}
          <button className="project-card project-card-add" type="button" onClick={() => { setCreating(true); setError('') }}><Plus size={23} /><strong>Add another project</strong><span>Start a separate grant folder</span></button>
        </div>
      </>}
    </main>
    {creating && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false) }}><form className="project-dialog" onSubmit={addProject}><div className="dialog-header"><div><span className="dashboard-eyebrow">NEW PROJECT</span><h2>Create a project folder</h2></div><button type="button" className="icon-button" onClick={() => setCreating(false)} aria-label="Close"><X size={18} /></button></div><p>Keep this grant separate from the demo case. This saves a folder in your browser; documents can be connected later.</p><label>Project name<input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Community Water Access" /></label><label>Organization <small>optional</small><input maxLength={80} value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="e.g. Water Care" /></label>{error && <div className="inline-error" role="alert">{error}</div>}<div className="project-dialog-actions"><button className="outline-button" type="button" onClick={() => setCreating(false)}>Cancel</button><button className="solid-button" type="submit">Create project <ArrowRight size={16} /></button></div></form></div>}
  </div>
}
