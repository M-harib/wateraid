import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileWarning, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type Props = {
  title: string
  url: string
  page?: number
  onPageChange: (page: number) => void
}

export function PdfPreview({ title, url, page, onPageChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(290)
  const [numPages, setNumPages] = useState<number>()
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, Math.floor(entry.contentRect.width - 20))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { setNumPages(undefined); setZoom(1) }, [url])

  const currentPage = Math.max(1, Math.min(page ?? 1, numPages ?? Number.MAX_SAFE_INTEGER))

  return (
    <div className="pdf-preview" ref={containerRef} aria-label={`${title} preview`}>
      <div className="pdf-page-scroll">
        <Document
          file={url}
          onLoadSuccess={({ numPages: total }) => setNumPages(total)}
          loading={<div className="pdf-message">Loading source page…</div>}
          error={<div className="pdf-message"><FileWarning size={22} /><span>Preview unavailable. Open the original PDF below.</span></div>}
        >
          <Page
            pageNumber={currentPage}
            width={Math.round(width * zoom)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<div className="pdf-message">Rendering page…</div>}
          />
        </Document>
      </div>
      <div className="pdf-pagination">
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous PDF page"><ChevronLeft size={15} /></button>
        <span>Page {currentPage}{numPages ? ` of ${numPages}` : ''}</span>
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={!numPages || currentPage >= numPages} aria-label="Next PDF page"><ChevronRight size={15} /></button>
        <span className="pdf-controls-divider" />
        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom <= 1} aria-label="Zoom out"><ZoomOut size={15} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.25))} disabled={zoom >= 2} aria-label="Zoom in"><ZoomIn size={15} /></button>
      </div>
    </div>
  )
}
