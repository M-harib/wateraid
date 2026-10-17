// SAMPLE DATA for the Reporting Calendar demo. Not a backend finding.
// The rules are copied from agreement 03, Appendix D §3 (schedule table) and §4 (report contents).
// Dates are generated in the browser from those rules so the calendar has something to show
// before the backend's date engine (check_dates) returns cited obligations. Delete this module,
// and its use in ReportingCalendar, once GET /obligations provides dated items.

export type CalendarCategory = 'Financial' | 'Narrative' | 'Construction'

export type ReportRule = {
  id: string
  title: string
  frequency: string
  due: string
  periodCovered: string
  forms?: string
  category: CalendarCategory
  includes: string
  page: number
  contentsPage: number
  note?: string
}

export type CalendarEvent = {
  id: string
  date: string // ISO yyyy-mm-dd
  rule: ReportRule
  period: string
}

export const sampleProject = { id: 'taps-for-rights', name: 'Taps for Rights', code: 'SYN-P0417' }

export const reportRules: ReportRule[] = [
  { id: '4.5', title: 'Budgetary Forecast', frequency: 'Semiannually', due: 'With each advance payment request', periodCovered: 'Period of the advance', forms: 'Form A; Form D', category: 'Financial', includes: 'Detailed estimates of Eligible Costs for the period of the advance, by the budget lines in Appendix C.', page: 14, contentsPage: 15 },
  { id: '4.6', title: 'Periodic Financial Report', frequency: 'Semiannually', due: 'Within 45 days following the period covered', periodCovered: 'Previous six months', forms: 'Form B; Form A', category: 'Financial', includes: 'Cumulative contribution, actual costs against forecast and budget, updated forecast and comments on variances, by the budget lines in Appendix C.', page: 14, contentsPage: 15 },
  { id: '4.7', title: 'Progress Report on Construction', frequency: 'Semiannually', due: 'With the Project Operations Report', periodCovered: 'April 1 to September 30; October 1 to March 31', category: 'Construction', includes: 'For structural works, reviewed and signed by the competent authority and annexed to each Project Operations Report.', page: 14, contentsPage: 16, note: 'Covers both half-years, but the Project Operations Report it travels with covers April to September only. Needs clarification.' },
  { id: '4.8', title: 'Project Operations Report', frequency: 'Semiannually', due: 'Within 45 days following the period covered', periodCovered: 'April 1 to September 30', category: 'Narrative', includes: 'All information set out in the International Assistance Results Reporting Guide for Partners.', page: 14, contentsPage: 16, note: 'Listed as semiannual, but only one period (April to September) is given. Needs clarification.' },
  { id: '4.9', title: 'Project Results Report', frequency: 'Annually', due: 'Within 45 days of the end of the Project year', periodCovered: 'April 1 to March 31', category: 'Narrative', includes: 'All information in the Results Reporting Guide for Partners, with the Visibility and Recognition Activities Report Form.', page: 15, contentsPage: 16 },
  { id: '4.10', title: 'Financial Statements', frequency: 'Annually', due: 'No later than September 30 of each year', periodCovered: "Organization's previous fiscal year", category: 'Financial', includes: "A copy of the Organization's annual audited financial statements.", page: 15, contentsPage: 16 },
]

// Rules tied to an event rather than a date (4.5) cannot be placed on the calendar.
export const eventLinkedRules = reportRules.filter((rule) => rule.id === '4.5')

function iso(date: Date) { return date.toISOString().slice(0, 10) }
function addDays(isoDate: string, days: number) { const d = new Date(`${isoDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return iso(d) }
function rule(id: string) { return reportRules.find((item) => item.id === id)! }

// Project years run 1 April to 31 March (App. D §3), from the Effective Date in 2019 to activities ending in 2023.
const firstYear = 2019
const lastYear = 2022

export function buildSampleEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (let year = firstYear; year <= lastYear; year++) {
    const halfOneEnd = `${year}-09-30`
    const halfTwoEnd = `${year + 1}-03-31`
    const halfOne = `Apr–Sep ${year}`
    const halfTwo = `Oct ${year}–Mar ${year + 1}`
    events.push({ id: `4.6-${halfOneEnd}`, date: addDays(halfOneEnd, 45), rule: rule('4.6'), period: halfOne })
    events.push({ id: `4.6-${halfTwoEnd}`, date: addDays(halfTwoEnd, 45), rule: rule('4.6'), period: halfTwo })
    events.push({ id: `4.8-${halfOneEnd}`, date: addDays(halfOneEnd, 45), rule: rule('4.8'), period: halfOne })
    events.push({ id: `4.7-${halfOneEnd}`, date: addDays(halfOneEnd, 45), rule: rule('4.7'), period: halfOne })
    events.push({ id: `4.9-${halfTwoEnd}`, date: addDays(halfTwoEnd, 45), rule: rule('4.9'), period: `Project year ${year}–${String(year + 1).slice(2)}` })
  }
  for (let year = firstYear; year <= lastYear + 1; year++) {
    events.push({ id: `4.10-${year}`, date: `${year}-09-30`, rule: rule('4.10'), period: `Fiscal year before ${year}` })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.rule.id.localeCompare(b.rule.id, undefined, { numeric: true }))
}
