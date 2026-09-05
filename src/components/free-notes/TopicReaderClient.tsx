'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Menu, X, Loader2, Check, FileText,
} from 'lucide-react'

// pdf.js (via react-pdf, inside PdfViewer) touches browser-only APIs
// (Canvas, DOMMatrix) at module load — ssr:false keeps it out of the
// server-render/hydration pass entirely, matching how this codebase
// already treats other truly browser-only concerns (see comments in
// src/lib/email.ts re: edge-runtime-only APIs).
const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false, loading: () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--muted)', fontSize: '13px' }}>
    Loading viewer…
  </div>
) })

interface TocTopic { id: string; title: string; noteNumber: number }
interface TocUnit { id: string; title: string; unitNumber: number; topics: TocTopic[] }

interface Props {
  subjectSlug: string
  subjectName: string
  tocUnits: TocUnit[]
  currentNoteId: string
  currentNoteTitle: string
  currentUnitTitle: string
  prevNoteId: string | null
  nextNoteId: string | null
  signedUrl: string | null
  initialCompletedNoteIds: string[]
  initialPercent: number
  initialTotal: number
  initialCompleted: number
}

// Forked from src/components/course/LessonReaderClient.tsx — same
// desktop sidebar / mobile drawer / sticky prev-next bar shape, adapted
// for a Subject -> Unit -> Topic PDF library instead of a Course ->
// Module -> Lesson block-content course. One deliberate difference:
// units are individually collapsible (only the current one starts
// open) since a subject can realistically have hundreds of topics
// across many units — LessonReaderClient's modules are always all
// expanded, which doesn't scale the same way here.
export default function TopicReaderClient({
  subjectSlug, subjectName, tocUnits,
  currentNoteId, currentNoteTitle, currentUnitTitle,
  prevNoteId, nextNoteId, signedUrl,
  initialCompletedNoteIds, initialPercent, initialTotal, initialCompleted,
}: Props) {
  const router = useRouter()
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompletedNoteIds))
  const [percent, setPercent] = useState(initialPercent)
  const [total, setTotal] = useState(initialTotal)
  const [completed, setCompleted] = useState(initialCompleted)
  const [marking, setMarking] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)

  const currentUnitId = tocUnits.find(u => u.topics.some(t => t.id === currentNoteId))?.id ?? null
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(currentUnitId)

  const isComplete = completedIds.has(currentNoteId)

  async function handleMarkComplete() {
    if (isComplete || marking) return
    setMarking(true)
    try {
      const res = await fetch('/api/free-notes-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_topic_complete', noteId: currentNoteId }),
      })
      const data = await res.json() as {
        success?: boolean
        progress?: { percent: number; total: number; completed: number }
      }
      if (!res.ok || !data.success) throw new Error('Failed to mark complete')

      setCompletedIds(prev => new Set(prev).add(currentNoteId))
      if (data.progress) {
        setPercent(data.progress.percent)
        setTotal(data.progress.total)
        setCompleted(data.progress.completed)
      }
    } catch (err) {
      console.error('[TopicReaderClient] mark complete failed:', err)
    } finally {
      setMarking(false)
    }
  }

  const tocContent = (
    <div style={{ padding: '4px 0' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <Link href={`/free-notes/${subjectSlug}`} style={{
          fontSize: '12px', color: 'var(--muted)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '10px',
        }}>
          <ChevronLeft size={12}/> {subjectName}
        </Link>
        {total > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              <span>Progress</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{completed}/{total}</span>
            </div>
            <div style={{ height: '5px', borderRadius: '4px', background: 'var(--card2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent-2)', borderRadius: '4px' }}/>
            </div>
          </>
        )}
      </div>
      {tocUnits.map(u => {
        const unitOpen = expandedUnitId === u.id
        return (
          <div key={u.id} style={{ marginBottom: '2px' }}>
            <button
              onClick={() => setExpandedUnitId(unitOpen ? null : u.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                padding: '10px 16px 6px', color: 'var(--muted2)',
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Unit {u.unitNumber} · {u.title}
              </span>
              {unitOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            </button>
            {unitOpen && u.topics.map(t => {
              const active = t.id === currentNoteId
              const done = completedIds.has(t.id)
              return (
                <Link key={t.id} href={`/free-notes/${subjectSlug}/${t.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 16px', margin: '1px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--muted)',
                    fontSize: '13px', fontWeight: active ? 600 : 400,
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  }}>
                    {done ? <CheckCircle2 size={14} color="var(--green)" style={{ flexShrink: 0 }}/>
                          : <Circle size={14} style={{ flexShrink: 0, opacity: 0.35 }}/>}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      })}
    </div>
  )

  return (
    <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
      {/* ── Desktop TOC sidebar ── */}
      <aside className="lesson-toc-desktop" style={{
        width: '260px', flexShrink: 0, borderRight: '1px solid var(--border)',
        overflowY: 'auto', background: 'var(--surface)',
      }}>
        {tocContent}
      </aside>

      {/* ── Mobile TOC drawer ── */}
      {tocOpen && (
        <div onClick={() => setTocOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 150,
        }} className="lesson-toc-overlay"/>
      )}
      <aside className="lesson-toc-mobile" style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', zIndex: 160,
        background: 'var(--surface)', borderRight: '1px solid var(--border)', overflowY: 'auto',
        transform: tocOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 10px 0' }}>
          <button onClick={() => setTocOpen(false)} aria-label="Close menu" style={{
            width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--text)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <X size={14}/>
          </button>
        </div>
        {tocContent}
      </aside>

      {/* ── Topic content ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '14px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <button onClick={() => setTocOpen(true)} className="lesson-toc-btn" style={{
            display: 'none', width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
            background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <Menu size={16}/>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', minWidth: 0, overflow: 'hidden' }}>
            <Link href="/free-notes" style={{ color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}>Handwritten Notes</Link>
            <ChevronRight size={12} style={{ flexShrink: 0 }}/>
            <Link href={`/free-notes/${subjectSlug}`} style={{ color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}>{subjectName}</Link>
            <ChevronRight size={12} style={{ flexShrink: 0 }}/>
            <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUnitTitle}</span>
          </div>
        </div>

        <div style={{ flex: 1, padding: '20px 28px 0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', color: 'var(--text)', marginBottom: '4px',
            }}>
              {currentNoteTitle}
            </div>
            {isComplete && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--green)' }}>
                <CheckCircle2 size={12}/> Completed
              </span>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, paddingBottom: '20px' }}>
            {signedUrl ? (
              <PdfViewer url={signedUrl} title={currentNoteTitle}/>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '48px', background: 'var(--card2)' }}>
                <FileText size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>
                  Notes not uploaded yet
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Check back soon — this topic is being prepared.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Mark complete + Prev/Next — sticky bottom bar ── */}
        <div style={{
          position: 'sticky', bottom: 0, borderTop: '1px solid var(--border)',
          background: 'var(--bg)', padding: '12px 28px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        }}>
          {prevNoteId ? (
            <button onClick={() => router.push(`/free-notes/${subjectSlug}/${prevNoteId}`)} className="btn btn-ghost" style={{ fontSize: '13px' }}>
              <ChevronLeft size={14}/> Previous
            </button>
          ) : <span/>}

          <button
            onClick={handleMarkComplete}
            disabled={isComplete || marking}
            className={isComplete ? 'btn btn-ghost' : 'btn btn-primary'}
            style={{ fontSize: '13px' }}
          >
            {marking ? <Loader2 size={14} className="spin"/>
              : isComplete ? <><Check size={14}/> Completed</>
              : <><CheckCircle2 size={14}/> Mark Complete</>}
          </button>

          {nextNoteId ? (
            <button onClick={() => router.push(`/free-notes/${subjectSlug}/${nextNoteId}`)} className="btn btn-primary" style={{ fontSize: '13px' }}>
              Next <ChevronRight size={14}/>
            </button>
          ) : (
            <Link href={`/free-notes/${subjectSlug}`} className="btn btn-primary" style={{ fontSize: '13px' }}>
              Finish subject <ChevronRight size={14}/>
            </Link>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }
        @media (max-width: 860px) {
          .lesson-toc-desktop { display: none !important; }
          .lesson-toc-btn { display: flex !important; }
        }
        @media (min-width: 861px) {
          .lesson-toc-mobile { display: none !important; }
          .lesson-toc-overlay { display: none !important; }
        }
      `}</style>
    </main>
  )
}
