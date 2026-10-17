export type Theme = 'light' | 'dark'

const storageKey = 'grantguard.theme.v1'

export function readTheme(): Theme {
  try { return window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light' }
  catch { return 'light' }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101216' : '#ffffff')
  try { window.localStorage.setItem(storageKey, theme) } catch { /* Keep the choice for this session. */ }
}
