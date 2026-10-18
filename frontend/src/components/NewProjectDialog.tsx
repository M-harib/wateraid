import { useEffect, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'

type Props = {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export function NewProjectDialog({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true); setError('')
    try { await onCreate(trimmed) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create the project.'); setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="review-dialog new-project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">NEW PROJECT</span>
            <h2 id="new-project-title">Create a project</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        </div>
        <label className="field-label">
          Project name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} placeholder="e.g. Coastal WASH 2026" />
        </label>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <div className="dialog-footer">
          <span>Documents you upload are scoped to this project.</span>
          <button className="button button-primary" type="button" disabled={!name.trim() || busy} onClick={() => void submit()}>{busy ? 'Creating…' : 'Create project'} <ArrowRight size={16} /></button>
        </div>
      </section>
    </div>
  )
}
