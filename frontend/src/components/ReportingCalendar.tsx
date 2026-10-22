import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { buildSampleEvents, eventLinkedRules, sampleProject, type CalendarEvent } from '../calendarMock'

type Props = { asOf: string; onOpenSource: (documentId: string, page?: number) => void }

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthFormat = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const longFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function toIso(year: number, month: number, day: number) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
function parts(isoDate: string) { const [y, m, d] = isoDate.split('-').map(Number); return { year: y, month: m - 1, day: d } }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) }

const monthIndex = (isoDate: string) => { const p = parts(isoDate); return p.year * 12 + p.month }
const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))

function timing(date: string, asOf: string): { label: string; tone: 'passed' | 'soon' | 'upcoming' } {
  const days = daysBetween(asOf, date)
  // Sample data cannot show whether a past report was submitted, so say when it was due, not that it was missed.
  if (days < 0) return { label: `Was due ${-days} day${days === -1 ? '' : 's'} before the case date`, tone: 'passed' }
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
  // First date with a report due strictly after the case date.
  const nextDue = events.find((event) => event.date > asOf)?.date ?? asOf
  const upcoming = events.filter((event) => event.date > asOf).slice(0, 3)
  const dueBefore = events.filter((event) => event.date < asOf).length
  // Navigation stays within the months that have reports, plus the case date's month.
  const minDate = events.length && events[0].date < asOf ? `${events[0].date.slice(0, 7)}-01` : `${asOf.slice(0, 7)}-01`
  const lastDate = events.length ? events[events.length - 1].date : asOf
  const maxDate = new Date(Date.UTC(parts(lastDate > asOf ? lastDate : asOf).year, parts(lastDate > asOf ? lastDate : asOf).month + 1, 0)).toISOString().slice(0, 10)
  // Open on the case date so it is visible; "Next due" then moves forward from it.
  const [selected, setSelected] = useState(asOf)
  const [view, setView] = useState(() => { const p = parts(asOf); return { year: p.year, month: p.month } })
  const detailRef = useRef<HTMLElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  // The date box is uncontrolled so typing is never interrupted; sync it when the selection
  // changes from elsewhere (a day click, a button), but not while someone is typing in it.
  useEffect(() => { const input = dateInputRef.current; if (input && document.activeElement !== input) input.value = selected }, [selected])

  const cells = useMemo(() => {
    const firstWeekday = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7
    const length = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
    return [...Array(firstWeekday).fill(null), ...Array.from({ length }, (_, index) => toIso(view.year, view.month, index + 1))] as (string | null)[]
  }, [view])
  const monthEvents = events.filter((event) => { const p = parts(event.date); return p.year === view.year && p.month === view.month })
  const selectedEvents = byDate.get(selected) ?? []

  const viewIndex = view.year * 12 + view.month
  const canGoBack = viewIndex > monthIndex(minDate)
  const canGoForward = viewIndex < monthIndex(maxDate)
  function shiftMonth(delta: number) { setView((current) => { const d = new Date(Date.UTC(current.year, current.month + delta, 1)); const next = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (next < monthIndex(minDate) || next > monthIndex(maxDate)) return current; return { year: d.getUTCFullYear(), month: d.getUTCMonth() } }) }
  function pick(isoDate: string, reveal = false) {
    if (!isCompleteDate(isoDate) || isoDate < minDate || isoDate > maxDate) return
    setSelected(isoDate); const p = parts(isoDate); setView({ year: p.year, month: p.month })
    // When the panels are stacked (narrow screens), bring the details into view.
    if (reveal && window.matchMedia('(max-width: 1100px)').matches) window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return <div className="rcal">
    <p className="rcal-sample" role="note"><strong>Sample data.</strong> Dates are generated in the browser from the agreement's reporting schedule (03 · Appendix D §3) for this demo. They are not backend findings and do not show whether a report was submitted.</p>
    <div className="rcal-layout">
      <section className="rcal-picker" aria-label="Choose a date">
        <div className="rcal-toolbar">
          <button type="button" className="rcal-nav" onClick={() => shiftMonth(-1)} disabled={!canGoBack} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <h2 aria-live="polite">{monthFormat.format(new Date(Date.UTC(view.year, view.month, 1)))}</h2>
          <button type="button" className="rcal-nav" onClick={() => shiftMonth(1)} disabled={!canGoForward} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        <div className="rcal-grid" role="group" aria-label="Reporting due dates">
          {weekdays.map((day) => <span className="rcal-weekday" key={day} aria-hidden="true">{day}</span>)}
          {cells.map((cell, index) => {
            if (!cell) return <span key={`blank-${index}`} aria-hidden="true" />
            const count = byDate.get(cell)?.length ?? 0
            const classes = ['rcal-day', cell === selected && 'selected', cell === asOf && 'as-of', count > 0 && 'has-events'].filter(Boolean).join(' ')
            return <button type="button" key={cell} className={classes} aria-pressed={cell === selected} aria-label={`${longFormat.format(new Date(`${cell}T00:00:00Z`))}${count ? `, ${count} report${count === 1 ? '' : 's'} due` : ''}${cell === asOf ? ', case date' : ''}`} onClick={() => pick(cell)}>
              <span>{parts(cell).day}</span>{count > 0 && <i aria-hidden="true">{count}</i>}{cell === asOf && <b aria-hidden="true">Case date</b>}
            </button>
          })}
        </div>
        <div className="rcal-jump">
          <label htmlFor="rcal-date">Jump to a date</label>
          <input id="rcal-date" ref={dateInputRef} type="date" defaultValue={selected} min={minDate} max={maxDate} onChange={(event) => pick(event.target.value)} onBlur={(event) => { if (event.currentTarget.value !== selected) event.currentTarget.value = selected }} />
          <button type="button" className="outline-button" onClick={() => pick(asOf, true)} disabled={selected === asOf}>Case date</button>
          <button type="button" className="outline-button" onClick={() => pick(nextDue, true)} disabled={selected === nextDue}>Next due after case date</button>
        </div>
        <ul className="rcal-legend" aria-label="Legend"><li><span className="dot events">1</span> Reports due that day</li><li><span className="dot as-of">{parts(asOf).day}</span> Case date ({longFormat.format(new Date(`${asOf}T00:00:00Z`))})</li></ul>
        {monthEvents.length > 0 && <div className="rcal-month-list"><span className="dashboard-eyebrow">THIS MONTH</span>{monthEvents.map((event) => <button type="button" key={event.id} onClick={() => pick(event.date)}><strong>{parts(event.date).day}</strong><span>{event.rule.id} {event.rule.title}</span></button>)}</div>}
      </section>

      <section className="rcal-detail" aria-labelledby="rcal-detail-title" ref={detailRef}>
        <span className="dashboard-eyebrow">SELECTED DATE</span>
        <h2 id="rcal-detail-title">{longFormat.format(new Date(`${selected}T00:00:00Z`))}{selected === asOf && <small className="rcal-case-tag">Case date</small>}</h2>
        {selectedEvents.length === 0 ? <div className="rcal-empty">
          <p>{selected === asOf ? `This is the case date. ${dueBefore} report${dueBefore === 1 ? ' was' : 's were'} due before it in the sample schedule.` : 'No reports fall due on this date.'}</p>
          {upcoming.length > 0 && <div className="rcal-upcoming"><span className="dashboard-eyebrow"><CalendarClock size={12} /> NEXT DUE AFTER THE CASE DATE</span>{upcoming.map((event) => <button type="button" key={event.id} onClick={() => pick(event.date)}><strong>{shortFormat.format(new Date(`${event.date}T00:00:00Z`))}</strong><span>{event.rule.id} {event.rule.title}</span><small>{timing(event.date, asOf).label}</small></button>)}</div>}
        </div> :
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
