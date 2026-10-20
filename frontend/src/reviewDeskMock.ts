// SAMPLE DATA for the Taps for Rights demo session only (Proposal draft → Review desk).
// Not backend output. Each suggestion points to the pack page it is based on so staff can check it.
// Delete this module, and its use in DraftWorkspace, once page-level suggestions come from the backend.

export type SampleSuggestion = { text: string; source: { documentId: string; page: number } }
export type SampleSuggestionSet = { heading: string; suggestions: SampleSuggestion[] }

const s = (text: string, documentId: string, page: number): SampleSuggestion => ({ text, source: { documentId, page } })

// Keyed by the preliminary-proposal template headings (see proposalTemplate.ts).
const byHeading: SampleSuggestionSet[] = [
  {
    heading: 'Organization name and contact information',
    suggestions: [
      s('Use the legal name exactly as it appears on the incorporation documents; the call asks for proof of legal status in Canada.', '01', 4),
      s('Name one initiative contact with title, phone and email so GAC has a single point of contact.', '02', 1),
      s('Confirm Water Care applies as the sole signatory; only one application per lead organization is considered.', '01', 4),
    ],
  },
  {
    heading: 'Eligibility requirements',
    suggestions: [
      s('State the cost share as a percentage and give the cash/in-kind split; the call requires at least 10% of total eligible direct project costs.', '01', 5),
      s('Do not count the soap manufacturer co-funding toward the 10%; third-party contributions cannot be part of the applicant’s cost share.', '02', 1),
      s('Reword or justify the plan to build new latrine blocks: the call excludes new construction and limits refurbishment to 25% of the existing footprint.', '01', 5),
      s('Attach the Local Partners – Information form; it is required, and it is not included in the pack.', '01', 6),
      s('Make sure both experience examples in section 3.1 show SRHR or health programming in ODA-eligible countries.', '01', 4),
    ],
  },
  {
    heading: 'Initiative summary',
    suggestions: [
      s('State the GAC amount requested; it must be at least $2 million and less than $20 million.', '01', 4),
      s('Keep the 2019-01-01 to 2021-12-31 dates: three years is within the required two-to-five-year range.', '01', 4),
      s('Use the same country names throughout (“Republic of Nimbara” and “Sundara”).', '02', 3),
    ],
  },
  {
    heading: '1.0 Rationale for the initiative',
    suggestions: [
      s('Fix “working across these three countries”: the project covers two, Nimbara and Sundara.', '02', 3),
      s('Add a source for “girls miss up to 20% of school days”, or soften the claim; unsupported figures weaken the case.', '02', 3),
      s('Name at least two of the call’s intermediate outcomes that the project contributes to.', '01', 3),
      s('Make the advocacy activities explicit; the call requires advocacy as cross-cutting work or as its own outcome.', '01', 3),
    ],
  },
  {
    heading: '2.0 Managing for results',
    suggestions: [
      s('Use the same wording for outcome 1200 in the theory of change and the logic model; the two versions differ.', '02', 5),
      s('Show how gender equality is fully integrated, for example sex- and age-disaggregated targets; the call gives priority to this.', '01', 4),
      s('Link each risk (insecurity, flooding, resistance from leaders) to a specific mitigation and output.', '02', 5),
    ],
  },
  {
    heading: '3.0 Organization ability relevant to the initiative',
    suggestions: [
      s('Fill in the approximate value for both examples; they are currently omitted.', '02', 6),
      s('Back “reduced diarrhoeal disease by 40%” with an evaluation or report reference.', '02', 6),
      s('Example 1 runs to 2019-03-31; say whether it is complete and where its results are reported.', '02', 6),
    ],
  },
]

const general: SampleSuggestionSet = {
  heading: 'Any page',
  suggestions: [
    s('Check every requirement on this page against the call’s mandatory parameters before submission.', '01', 4),
    s('Replace general claims with specific, sourced figures, or say the evidence is not yet available.', '02', 3),
  ],
}

// Which template sections each page of the case proposal PDF (document 02) covers, so pages imported
// with "Start from case proposal" (headed "Page 1" … "Page 6") still get suggestions.
const caseProposalPages: Record<number, string[]> = {
  1: ['Organization name and contact information', 'Eligibility requirements'],
  2: ['Eligibility requirements', 'Initiative summary'],
  3: ['Initiative summary', '1.0 Rationale for the initiative'],
  4: ['1.0 Rationale for the initiative', '2.0 Managing for results'],
  5: ['2.0 Managing for results'],
  6: ['3.0 Organization ability relevant to the initiative'],
}

function byHeadingMatch(heading: string): SampleSuggestionSet | undefined {
  const key = heading.trim().toLowerCase()
  if (key.length < 4) return undefined
  return byHeading.find((set) => key.startsWith(set.heading.toLowerCase()) || set.heading.toLowerCase().startsWith(key))
}

export function sampleSuggestionsFor(section: { heading: string; citations: { documentId: string; page?: number }[] }): SampleSuggestionSet {
  const match = byHeadingMatch(section.heading)
  if (match) return match
  const page = section.citations.find((citation) => citation.documentId === '02' && citation.page)?.page
  const sets = (page ? caseProposalPages[page] ?? [] : []).map(byHeadingMatch).filter((set): set is SampleSuggestionSet => Boolean(set))
  if (!sets.length) return general
  return { heading: sets.map((set) => set.heading).join(' · '), suggestions: sets.flatMap((set) => set.suggestions) }
}

export function suggestionsAsBullets(set: SampleSuggestionSet): string {
  return set.suggestions.map((item) => `• ${item.text}`).join('\n')
}
