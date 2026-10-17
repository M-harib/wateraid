export function BrandMark({ light = false }: { light?: boolean }) {
  return <span className={`brand-mark ${light ? 'brand-mark-light' : ''}`} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M16 4C12.6 9.2 8.3 13.7 8.3 19a7.7 7.7 0 0 0 15.4 0C23.7 13.7 19.4 9.2 16 4Z" fill="currentColor"/><path d="M12.1 19.6c.2 2 1.7 3.6 3.7 3.9" stroke="var(--mark-stroke)" strokeWidth="1.7" strokeLinecap="round"/><path d="M5 27.6c3.6-1.6 6.8-1.6 10.4 0m1.2 0c3.6 1.6 6.8 1.6 10.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></span>
}
