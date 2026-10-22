// Mark: a page with a folded corner and a check, i.e. "checked against the source".
// The page takes the tile's text colour; the fold and check take the tile colour, so it works in both themes.
export function BrandMark({ light = false }: { light?: boolean }) {
  return <span className={`brand-mark ${light ? 'brand-mark-light' : ''}`} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M10.5 4.5h8l6 6V25a2.5 2.5 0 0 1-2.5 2.5h-11.5A2.5 2.5 0 0 1 8 25V7a2.5 2.5 0 0 1 2.5-2.5Z" fill="currentColor"/><path d="M18.5 4.8v4.2a1.5 1.5 0 0 0 1.5 1.5h4.2" stroke="var(--button)" strokeWidth="1.5" strokeLinejoin="round"/><path d="M11.8 17.8l3.1 3.1 5.6-6.2" stroke="var(--button)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
}
