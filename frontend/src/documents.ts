import guideUrl from '../../assets/00_Start_Here_A6_Taps_for_Rights.pdf?url'
import callUrl from '../../assets/01_Funding_Call_GAC_2018.pdf?url'
import proposalUrl from '../../assets/02_Preliminary_Proposal_Taps_for_Rights.pdf?url'
import agreementUrl from '../../assets/03_Contribution_Agreement_Taps_for_Rights.pdf?url'
import reportUrl from '../../assets/04_Year3_Results_Report_Taps_for_Rights.pdf?url'
import pmfUrl from '../../assets/05_Logic_Model_and_PMF_Taps_for_Rights.xlsx?url'
import budgetUrl from '../../assets/06_Budget_Template_Taps_for_Rights.xlsx?url'

export type SourceDocument = {
  id: string
  title: string
  shortTitle: string
  description: string
  category: 'Guide' | 'Agreement' | 'Report' | 'Proposal' | 'Framework' | 'Budget' | 'Call'
  format: 'PDF' | 'XLSX'
  url: string
}

export const documents: SourceDocument[] = [
  {
    id: '00',
    title: 'Challenge guide',
    shortTitle: 'Participant guide',
    description: 'Challenge rules, source list and 25 evaluation questions.',
    category: 'Guide',
    format: 'PDF',
    url: guideUrl,
  },
  {
    id: '01',
    title: '2018 GAC funding call',
    shortTitle: 'Funding call',
    description: 'The public call used to check proposal requirements.',
    category: 'Call',
    format: 'PDF',
    url: callUrl,
  },
  {
    id: '02',
    title: 'Taps for Rights preliminary proposal',
    shortTitle: 'Preliminary proposal',
    description: 'The fictional project application in the source pack.',
    category: 'Proposal',
    format: 'PDF',
    url: proposalUrl,
  },
  {
    id: '03',
    title: 'Taps for Rights contribution agreement',
    shortTitle: 'Contribution agreement',
    description: 'Agreement articles, appendices and reporting requirements.',
    category: 'Agreement',
    format: 'PDF',
    url: agreementUrl,
  },
  {
    id: '04',
    title: 'Year 3 results report',
    shortTitle: 'Year 3 results report',
    description: 'Annual report for the April 2021 to March 2022 period.',
    category: 'Report',
    format: 'PDF',
    url: reportUrl,
  },
  {
    id: '05',
    title: 'Logic model and PMF',
    shortTitle: 'Logic model & PMF',
    description: 'Outcomes, activities, indicators, baselines and targets.',
    category: 'Framework',
    format: 'XLSX',
    url: pmfUrl,
  },
  {
    id: '06',
    title: 'Budget template',
    shortTitle: 'Budget template',
    description: 'Categories and rules; the pack includes no budget figures.',
    category: 'Budget',
    format: 'XLSX',
    url: budgetUrl,
  },
]

export const documentById = Object.fromEntries(documents.map((document) => [document.id, document])) as Record<string, SourceDocument>
