import { useEffect, useRef, useState } from 'react'
import { FileWarning, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type Props = {
  title: string
  url: string
  page?: number
  highlight?: string
}

const norm = (s: string) =>
  s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function PdfPreview({ title, url, page, highlight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(290)
  const [numPages, setNumPages] = useState<number>()
  const [zoom, setZoom] = useState(1)
  const [blobUrl, setBlobUrl] = useState<string>()
  const [loadError, setLoadError] = useState('')
  const scrolledRef = useRef('')

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, Math.floor(entry.contentRect.width - 20))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Fetch the file ourselves and hand react-pdf a same-origin blob URL. This avoids the
  // cross-origin fetch/range/cache quirks (and the StrictMode load race) that leave the
  // viewer stuck blank when react-pdf fetches a cross-origin URL directly.
  useEffect(() => {
    let active = true
    let created: string | undefined
    setBlobUrl(undefined); setLoadError(''); setNumPages(undefined); setZoom(1); scrolledRef.current = ''
    fetch(url, { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error(`The document service returned ${response.status}.`); return response.blob() })
      .then((blob) => { if (!active) return; created = URL.createObjectURL(blob); setBlobUrl(created) })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load the PDF.') })
    return () => { active = false; if (created) URL.revokeObjectURL(created) }
  }, [url])

  useEffect(() => { scrolledRef.current = '' }, [page, highlight])

  const target = highlight ? norm(highlight) : ''
  const scrollKey = `${page ?? ''}|${highlight ?? ''}`

  // Highlight text items whose normalized text falls within the cited excerpt.
  // Best-effort text search; the excerpt comes from the backend evidence.
  const textRenderer = target
    ? ({ str }: { str: string }) => {
        const n = norm(str)
        const hit = n.length >= 5 && target.includes(n)
        return hit ? `<mark class="pdf-mark">${escapeHtml(str)}</mark>` : escapeHtml(str)
      }
    : undefined

  // Jump to a cited page once it is known (no excerpt to anchor on).
  useEffect(() => {
    if (!numPages || !page || highlight || scrolledRef.current === scrollKey) return
    containerRef.current?.querySelector(`#pdf-page-${page}`)?.scrollIntoView({ block: 'start' })
    scrolledRef.current = scrollKey
  }, [numPages, page, highlight, scrollKey])

  // Once a highlighted page's text renders, scroll the first match into view.
  const anchorHighlight = () => {
    if (!highlight || scrolledRef.current === scrollKey) return
    const mark = containerRef.current?.querySelector('mark.pdf-mark')
    if (mark) { mark.scrollIntoView({ block: 'center' }); scrolledRef.current = scrollKey }
  }

  return (
    <div className="pdf-preview" ref={containerRef} aria-label={`${title} preview`}>
      <div className="pdf-page-scroll">
        {loadError
          ? <div className="pdf-message"><FileWarning size={22} /><span>{loadError} Open the original PDF below.</span></div>
          : !blobUrl
            ? <div className="pdf-message">Loading document…</div>
            : <Document
                file={blobUrl}
                onLoadSuccess={({ numPages: total }) => setNumPages(total)}
                onLoadError={(error) => setLoadError(error.message)}
                loading={<div className="pdf-message">Loading document…</div>}
                error={<div className="pdf-message"><FileWarning size={22} /><span>Preview unavailable. Open the original PDF below.</span></div>}
              >
                {Array.from({ length: numPages ?? 0 }, (_, index) => (
                  <div className="pdf-page-wrap" id={`pdf-page-${index + 1}`} key={index + 1}>
                    <Page
                      pageNumber={index + 1}
                      width={Math.round(width * zoom)}
                      renderTextLayer
                      renderAnnotationLayer={false}
                      customTextRenderer={textRenderer}
                      onRenderTextLayerSuccess={anchorHighlight}
                      loading={<div className="pdf-message">Rendering page…</div>}
                    />
                  </div>
                ))}
              </Document>}
      </div>
      <div className="pdf-pagination">
        <span>{numPages ? `${numPages} page${numPages === 1 ? '' : 's'}` : ''}</span>
        <span className="pdf-controls-divider" />
        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom <= 1} aria-label="Zoom out"><ZoomOut size={15} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.25))} disabled={zoom >= 2} aria-label="Zoom in"><ZoomIn size={15} /></button>
      </div>
    </div>
  )
}
