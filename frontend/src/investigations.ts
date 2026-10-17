export type Investigation = {
  id: string
  questionNumber: number
  category: string
  title: string
  question: string
  description: string
  documentIds: string[]
  steps: string[]
}

// These are prompts from file 00, page 3. They contain no answers or grant findings.
export const investigations: Investigation[] = [
  {
    id: 'question-08',
    questionNumber: 8,
    category: 'Reporting',
    title: 'Year 3 report timing',
    question: 'When was the Year 3 annual results report due, and was it submitted on time?',
    description: 'Compare the agreement’s reporting rule with the report’s stated submission date.',
    documentIds: ['03', '04'],
    steps: ['Locate the annual reporting rule', 'Find the report date', 'Calculate and compare in code'],
  },
  {
    id: 'question-11',
    questionNumber: 11,
    category: 'Deadline conflict',
    title: 'Final report due date',
    question: 'When is the final results and operations report due? Is the agreement consistent on this?',
    description: 'Look for all applicable due-date statements before drawing a conclusion.',
    documentIds: ['03'],
    steps: ['Collect each relevant clause', 'Normalize date rules', 'Show any disagreement with both sources'],
  },
  {
    id: 'question-24',
    questionNumber: 24,
    category: 'Cross-document check',
    title: 'Reporting period consistency',
    question: 'Which documents disagree about the reporting period or due dates of the Year 3 report?',
    description: 'Keep conflicting statements visible and identify who should resolve them.',
    documentIds: ['03', '04'],
    steps: ['Compare the period definitions', 'Compare the stated due dates', 'Escalate unresolved conflicts'],
  },
]
