import type { DraftSection } from './draft'

export const preliminaryProposalTemplate = {
  id: 'gac-preliminary-2018',
  label: 'Preliminary proposal outline',
  description: 'Headings from the supplied synthetic preliminary proposal. Adapt them to the current funding call.',
  pages: [
    {
      heading: 'Organization name and contact information',
      body: 'Organization name:\n\nInitiative contact name:\n\nPosition title:\n\nCountry:\n\nContact telephone and email:\n',
    },
    {
      heading: 'Eligibility requirements',
      body: 'A. Cost share\n\nB. Not-for-profit proposal\n\nC. Locally-driven proposal\n\nD. Relevant experience\n\nE. Construction and refurbishment of existing structures\n',
    },
    {
      heading: 'Initiative summary',
      body: 'Title of the initiative:\n\nProposed start date:\n\nProposed end date:\n\nTotal Global Affairs Canada funding requested:\n\nSector(s):\n\nCountry(ies):\n\nSignatory number:\n',
    },
    {
      heading: '1.0 Rationale for the initiative',
      body: '1.1 Project summary\n\n1.2 Innovation\n\n1.3 Alignment\n\n1.4 Support from the private sector\n',
    },
    {
      heading: '2.0 Managing for results',
      body: '2.1 Preliminary theory of change\n\nIntermediate outcomes:\n\nGender equality:\n\nRisks:\n\nSustainability:\n\n2.2 Logic model\n\nUltimate outcome:\n\nIntermediate outcomes:\n\nImmediate outcomes:\n\nOutputs:\n',
    },
    {
      heading: '3.0 Organization ability relevant to the initiative',
      body: '3.1 Relevant applicant experience\n\nExample 1\nInitiative name:\nApproximate value:\nCountry and location:\nRecipient:\nDates:\nFunding agency:\nProject description:\n\nExample 2\nInitiative name:\nApproximate value:\nCountry and location:\nRecipient:\nDates:\nFunding agency:\nProject description:\n',
    },
  ],
} as const

export function createTemplateSections(): DraftSection[] {
  return preliminaryProposalTemplate.pages.map((page) => ({
    id: crypto.randomUUID(),
    heading: page.heading,
    body: page.body,
    citations: [],
  }))
}
