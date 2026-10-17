import { useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { buildSampleEvents, eventLinkedRules, sampleProject, type CalendarEvent } from '../calendarMock'

type Props = { asOf: string; onOpenSource: (documentId: string, page?: number) => void }

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthFormat = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const longFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function toIso(year: number, month: number, day: number) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
function parts(isoDate: string) { const [y, m, d] = isoDate.split('-').map(Number); return { year: y, month: m - 1, day: d } }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) }

function timing(date: string, asOf: string): { label: string; tone: 'passed' | 'soon' | 'upcoming' } {
  const days = daysBetween(asOf, date)
  if (days < 0) return { label: `Due date passed ${-days} day${days === -1 ? '' : 's'} before ${asOf}`, tone: 'passed' }
  if (days <= 60) return { label: days === 0 ? 'Due on the case date' : `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'soon' }
  return { label: `Due in ${days} days`, tone: 'upcoming' }
}

export function ReportingCalendar({ asOf, onOpenSource }: Props) {
  const events = useMemo(buildSampleEvents, [])
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) map.set(event.date, [...(map.get(event.date) ?? []), event])
    return map
  }, [events])
  const nextDue = events.find((event) => event.date >= asOf)?.date ?? asOf
  const [selected, setSelected] = useState(nextDue)
  const [view, setView] = useState(() => { const p = parts(nextDue); return { year: p.year, month: p.month } })

  const cells = useMemo(() => {
    const firstWeekday = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7
    const length = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
    return [...Array(firstWeekday).fill(null), ...Array.from({ length }, (_, index) => toIso(view.year, view.month, index + 1))] as (string | null)[]
  }, [view])
  const monthEvents = events.filter((event) => { const p = parts(event.date); return p.year === view.year && p.month === view.month })
  const selectedEvents = byDate.get(selected) ?? []

  function shiftMonth(delta: number) { setView((current) => { const d = new Date(Date.UTC(current.year, current.month + delta, 1)); return { year: d.getUTCFullYear(), month: d.getUTCMonth() } }) }
  function pick(isoDate: string) { if (!isoDate) return; setSelected(isoDate); const p = parts(isoDate); setView({ year: p.year, month: p.month }) }

  return <div className="rcal">
    <p className="rcal-sample" role="note"><strong>Sample data.</strong> Dates are generated in the browser from the agreement's reporting schedule (03 · Appendix D §3) for this demo. They are not backend findings and do not show whether a report was submitted.</p>
    <div className="rcal-layout">
      <section className="rcal-picker" aria-label="Choose a date">
        <div className="rcal-toolbar">
          <button type="button" className="rcal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <h2 aria-live="polite">{monthFormat.format(new Date(Date.UTC(view.year, view.month, 1)))}</h2>
          <button type="button" className="rcal-nav" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        <div className="rcal-grid" role="group" aria-label="Reporting due dates">
          {weekdays.map((day) => <span className="rcal-weekday" key={day} aria-hidden="true">{day}</span>)}
          {cells.map((cell, index) => {
            if (!cell) return <span key={`blank-${index}`} aria-hidden="true" />
            const count = byDate.get(cell)?.length ?? 0
            const classes = ['rcal-day', cell === selected && 'selected', cell === asOf && 'as-of', count > 0 && 'has-events'].filter(Boolean).join(' ')
            return <button type="button" key={cell} className={classes} aria-pressed={cell === selected} aria-label={`${longFormat.format(new Date(`${cell}T00:00:00Z`))}${count ? `, ${count} report${count === 1 ? '' : 's'} due` : ''}${cell === asOf ? ', case date' : ''}`} onClick={() => pick(cell)}>
              <span>{parts(cell).day}</span>{count > 0 && <i aria-hidden="true">{count}</i>}
            </button>
          })}
        </div>
        <div className="rcal-jump">
          <label htmlFor="rcal-date">Jump to a date</label>
          <input id="rcal-date" type="date" value={selected} min="2019-06-01" max="2023-12-31" onChange={(event) => pick(event.target.value)} />
          <button type="button" className="outline-button" onClick={() => pick(nextDue)}>Next due after case date</button>
        </div>
        <ul className="rcal-legend" aria-label="Legend"><li><span className="dot events" /> Report due</li><li><span className="dot as-of" /> Case date ({asOf})</li></ul>
        {monthEvents.length > 0 && <div className="rcal-month-list"><span className="dashboard-eyebrow">THIS MONTH</span>{monthEvents.map((event) => <button type="button" key={event.id} onClick={() => pick(event.date)}><strong>{parts(event.date).day}</strong><span>{event.rule.id} {event.rule.title}</span></button>)}</div>}
      </section>

      <section className="rcal-detail" aria-labelledby="rcal-detail-title">
        <span className="dashboard-eyebrow">SELECTED DATE</span>
        <h2 id="rcal-detail-title">{longFormat.format(new Date(`${selected}T00:00:00Z`))}</h2>
        {selectedEvents.length === 0 ? <p className="rcal-empty">No reports fall due on this date. Pick a highlighted day, or use "Next due after case date".</p> :
          <ul className="rcal-events">{selectedEvents.map((event) => { const when = timing(event.date, asOf); return <li key={event.id} className="rcal-event">
            <div className="rcal-tags">
              <span className="rcal-tag project">{sampleProject.name} · {sampleProject.code}</span>
              <span className={`rcal-tag category ${event.rule.category.toLowerCase()}`}>{event.rule.category}</span>
              <span className="rcal-tag">{event.rule.frequency}</span>
              <span className={`rcal-tag timing ${when.tone}`}>{when.label}</span>
              <span className="rcal-tag sample">Sample data</span>
            </div>
            <h3>{event.rule.id} {event.rule.title}</h3>
            <dl>
              <div><dt>Period</dt><dd>{event.period} <small>(agreement: {event.rule.periodCovered})</small></dd></div>
              <div><dt>Due rule</dt><dd>“{event.rule.due}”</dd></div>
              <div><dt>Must include</dt><dd>{event.rule.includes}</dd></div>
              {event.rule.forms && <div><dt>Reference forms</dt><dd>{event.rule.forms}</dd></div>}
            </dl>
            {event.rule.note && <p className="rcal-note"><strong>Needs clarification:</strong> {event.rule.note.replace(' Needs clarification.', '')}</p>}
            <div className="rcal-sources">
              <button type="button" onClick={() => onOpenSource('03', event.rule.page)}>Schedule · 03 App. D §3 · p.{event.rule.page} <ArrowRight size={13} /></button>
              <button type="button" onClick={() => onOpenSource('03', event.rule.contentsPage)}>Contents · 03 App. D §{event.rule.id} · p.{event.rule.contentsPage} <ArrowRight size={13} /></button>
            </div>
          </li> })}</ul>}
        {eventLinkedRules.length > 0 && <div className="rcal-linked"><span className="dashboard-eyebrow"><Link2 size={12} /> NO FIXED DATE</span>{eventLinkedRules.map((rule) => <p key={rule.id}><strong>{rule.id} {rule.title}</strong> is due “{rule.due.toLowerCase()}” ({rule.forms}), so it is not placed on the calendar. <button type="button" onClick={() => onOpenSource('03', rule.page)}>03 · p.{rule.page}</button></p>)}</div>}
      </section>
    </div>
  </div>
}
