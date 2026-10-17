import { useEffect, useRef, useState } from 'react'
import { FileWarning, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// Fetch the whole PDF in one plain GET. Cross-origin range requests need extra CORS
// (exposed Content-Range) that browsers hide by default; a single GET sidesteps that.
const DOC_OPTIONS = { disableStream: true, disableAutoFetch: true, disableRange: true }

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
  const scrolledRef = useRef('')

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, Math.floor(entry.contentRect.width - 20))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { setNumPages(undefined); setZoom(1) }, [url])
  useEffect(() => { scrolledRef.current = '' }, [url, page, highlight])

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
        <Document
          file={url}
          options={DOC_OPTIONS}
          onLoadSuccess={({ numPages: total }) => setNumPages(total)}
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
        </Document>
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
