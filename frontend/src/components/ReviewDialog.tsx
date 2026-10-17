import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Pencil, ShieldAlert, X } from 'lucide-react'
import type { Finding } from '../domain'
import type { ReviewDecision } from '../reviews'

const choices: { value: ReviewDecision; label: string; description: string; icon: typeof Check }[] = [
  { value: 'confirmed', label: 'Confirm', description: 'The finding is ready to act on.', icon: Check },
  { value: 'corrected', label: 'Correct', description: 'Record a corrected interpretation.', icon: Pencil },
  { value: 'dismissed', label: 'Dismiss', description: 'Keep an audit trail for this decision.', icon: X },
  { value: 'escalated', label: 'Escalate', description: 'Someone else must resolve this.', icon: ShieldAlert },
  { value: 'clarification_requested', label: 'Request clarification', description: 'More evidence is needed.', icon: CircleHelp },
]

type Props = {
  finding: Finding
  onClose: () => void
  onSave: (decision: ReviewDecision, note: string, correctedValue?: string) => void
}

export function ReviewDialog({ finding, onClose, onSave }: Props) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null)
  const [note, setNote] = useState('')
  const [correctedValue, setCorrectedValue] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const needsCorrection = decision === 'corrected'
  const canSave = !!decision && (!needsCorrection || correctedValue.trim().length > 0)

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">HUMAN REVIEW</span>
            <h2 id="review-title">Record a decision</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close review dialog"><X size={19} /></button>
        </div>
        <p className="dialog-finding">{finding.title}</p>
        <div className="review-choice-grid" role="group" aria-label="Review decision">
          {choices.map(({ value, label, description, icon: Icon }) => (
            <button
              className={`review-choice ${decision === value ? 'is-selected' : ''}`}
              type="button"
              key={value}
              onClick={() => setDecision(value)}
              aria-pressed={decision === value}
            >
              <Icon size={18} />
              <span><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
        </div>
        {needsCorrection && (
          <label className="field-label">
            Corrected interpretation <span className="required">*</span>
            <textarea value={correctedValue} onChange={(event) => setCorrectedValue(event.target.value)} placeholder="What should this finding say instead?" rows={3} />
          </label>
        )}
        <label className="field-label">
          Decision note <span className="optional">optional</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add the reason or who should follow up…" rows={3} />
        </label>
        <div className="dialog-footer">
          <span>Stored in this browser for the prototype.</span>
          <button
            className="button button-primary"
            type="button"
            disabled={!canSave}
            onClick={() => { if (decision) onSave(decision, note.trim(), needsCorrection ? correctedValue.trim() : undefined) }}
          >
            Save decision <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  )
}
