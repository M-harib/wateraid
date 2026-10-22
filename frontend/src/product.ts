// Product name and copy in one place. "GrantProof" is a working name: to rename the product,
// change these values (index.html reads them at build time through vite.config.ts) and the docs.
//
// Browser storage keys, the IndexedDB name and drag-and-drop types still use the original
// "grantguard" prefix on purpose: changing them would orphan drafts, reviews, projects and
// theme choices already saved in people's browsers. Rename those only together with a migration.
export const APP_NAME = 'GrantProof'
export const APP_TAGLINE = 'Evidence-first grant workspace'
export const APP_DESCRIPTION = `${APP_NAME} helps staff ask, inspect, and review grant questions with traceable source documents.`
