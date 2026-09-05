'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, Download,
  ChevronUp, ChevronDown, Loader2, AlertTriangle,
} from 'lucide-react'

// Version-matched CDN worker — the standard way to wire react-pdf into
// a Next.js app with no custom webpack/turbopack config (confirmed
// next.config.ts has none). Always matches whatever pdfjs-dist version
// react-pdf itself pins, so this never drifts out of sync on upgrade.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const SCALE_STEP = 0.15
const DEFAULT_SCALE = 1.1

export default function PdfViewer({ url, title }: { url: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)
  const [fitWidth, setFitWidth] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Measure the container so "fit to width" can size pages exactly —
  // react-pdf's Page takes an explicit pixel width, not a CSS percentage.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // Track which page is currently in view as the student scrolls, so
  // the page-number indicator stays accurate without them touching the
  // nav buttons — the same "smooth scrolling with a live indicator"
  // feel as a modern document reader.
  useEffect(() => {
    if (!numPages) return
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const page = Number((visible.target as HTMLElement).dataset.page)
          if (page) setCurrentPage(page)
        }
      },
      { root: el, threshold: [0.5] }
    )
    Object.values(pageRefs.current).forEach(node => { if (node) observer.observe(node) })
    return () => observer.disconnect()
  }, [numPages])

  const pageWidth = useMemo(() => {
    if (!fitWidth || !containerWidth) return undefined
    return Math.min(containerWidth - 32, 900) * (scale / DEFAULT_SCALE)
  }, [fitWidth, containerWidth, scale])

  function zoomIn() { setFitWidth(false); setScale(s => Math.min(MAX_SCALE, s + SCALE_STEP)) }
  function zoomOut() { setFitWidth(false); setScale(s => Math.max(MIN_SCALE, s - SCALE_STEP)) }
  function resetZoom() { setFitWidth(true); setScale(DEFAULT_SCALE) }

  function goToPage(page: number) {
    const node = pageRefs.current[page]
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await containerRef.current.requestFullscreen()
    }
  }

  return (
    <div
      ref={containerRef}
      className="card"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%', padding: 0,
        overflow: 'hidden', background: isFullscreen ? 'var(--bg)' : undefined,
      }}
    >
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        padding: '8px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={zoomOut} disabled={scale <= MIN_SCALE} className="btn btn-ghost" style={{ padding: '5px 8px' }} title="Zoom out">
            <ZoomOut size={14}/>
          </button>
          <button onClick={resetZoom} className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: '11px', minWidth: '48px' }} title="Fit to width">
            {fitWidth ? 'Fit' : `${Math.round((scale / DEFAULT_SCALE) * 100)}%`}
          </button>
          <button onClick={zoomIn} disabled={scale >= MAX_SCALE} className="btn btn-ghost" style={{ padding: '5px 8px' }} title="Zoom in">
            <ZoomIn size={14}/>
          </button>
        </div>

        {numPages && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--muted)' }}>
            <button onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="btn btn-ghost" style={{ padding: '5px 6px' }} title="Previous page">
              <ChevronUp size={13}/>
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', minWidth: '64px', textAlign: 'center' }}>
              Page {currentPage} / {numPages}
            </span>
            <button onClick={() => goToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} className="btn btn-ghost" style={{ padding: '5px 6px' }} title="Next page">
              <ChevronDown size={13}/>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <a href={url} download target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '5px 8px' }} title="Download PDF">
            <Download size={14}/>
          </a>
          <button onClick={toggleFullscreen} className="btn btn-ghost" style={{ padding: '5px 8px' }} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
          </button>
        </div>
      </div>

      {/* ── Pages ── */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--card2)', padding: '20px 0' }}>
        {loadError ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
            <AlertTriangle size={24} color="var(--red)" style={{ marginBottom: '10px' }}/>
            <div style={{ fontSize: '13px' }}>{loadError}</div>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setLoadError('Could not load this PDF. Try downloading it instead.')}
            loading={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--muted)', gap: '8px' }}>
                <Loader2 size={16} className="spin"/> Loading {title}…
              </div>
            }
          >
            {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={el => { pageRefs.current[pageNum] = el }}
                style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}
              >
                <Page
                  pageNumber={pageNum}
                  width={pageWidth}
                  scale={fitWidth ? undefined : scale}
                  renderAnnotationLayer
                  renderTextLayer
                  className="pdf-page"
                />
              </div>
            ))}
          </Document>
        )}
      </div>

      <style>{`
        .pdf-page canvas { box-shadow: 0 1px 4px rgba(0,0,0,0.25); border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
