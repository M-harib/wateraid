import { ArrowRight, ArrowUpRight, MessageSquareText, X } from 'lucide-react'
import type { AskAnswer } from '../api'
import { documentById } from '../documents'
import { investigations } from '../investigations'

type Props = {
  question: string
  onQuestion: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  answer: AskAnswer | null
  error: string
  asking: boolean
  connected: boolean
  onClose: () => void
  onCitation: (documentId: string, page?: number) => void
}

export function AskPanel({ question, onQuestion, onSubmit, answer, error, asking, connected, onClose, onCitation }: Props) {
  return <aside className="workspace-assistant" aria-label="Ask the documents">
    <div className="assistant-head"><span className="assistant-icon"><MessageSquareText size={18} /></span><div><strong>Ask the documents</strong><small>All Taps for Rights sources</small></div><button type="button" onClick={onClose} aria-label="Close assistant"><X size={18} /></button></div>
    <div className="assistant-content">
      {!answer && !error && <div className="assistant-intro"><span className="dashboard-eyebrow">SOURCE-GROUNDED Q&A</span><h2>Ask while you read.</h2><p>Answers appear here with source links. Open a citation to inspect the original document in the center.</p></div>}
      {error && <div className="inline-error" role="alert">{error}</div>}
      {answer && <div className="assistant-answer"><span className="dashboard-eyebrow">{answer.status.replaceAll('_', ' ')} · REVIEW THE SOURCES</span><p>{answer.answer}</p>{answer.evidence.length ? <div className="assistant-citations">{answer.evidence.map((item, index) => <button type="button" key={`${item.documentId}-${index}`} onClick={() => onCitation(item.documentId, item.locator.page)}><span><strong>{documentById[item.documentId]?.shortTitle ?? `Document ${item.documentId}`}</strong><small>{item.locator.page ? `Page ${item.locator.page}` : item.locator.sheet ? `${item.locator.sheet} ${item.locator.cells ?? ''}` : item.locator.section ?? 'Source section'}</small>{item.excerpt && <em>“{item.excerpt}”</em>}</span><ArrowUpRight size={15} /></button>)}</div> : <small>No source references were returned. Treat this response as unverified.</small>}</div>}
      <div className="assistant-prompts"><span className="dashboard-eyebrow">EXPLORE THE CASE</span>{investigations.map((item) => <button type="button" key={item.id} onClick={() => onQuestion(item.question)}><span>{String(item.questionNumber).padStart(2, '0')}</span>{item.question}<ArrowRight size={14} /></button>)}<small>Guide questions are prompts, not generated findings.</small></div>
    </div>
    <form className="assistant-composer" onSubmit={onSubmit}><label htmlFor="workspace-question">Your question</label><textarea id="workspace-question" rows={3} value={question} onChange={(event) => onQuestion(event.target.value)} placeholder="What does the agreement require?" /><div><small>{connected ? 'Responses use the case source pack.' : 'Analysis service required for answers.'}</small><button type="submit" disabled={!question.trim() || asking} aria-label="Ask question">{asking ? 'Checking…' : 'Ask'} <ArrowRight size={15} /></button></div></form>
  </aside>
}
