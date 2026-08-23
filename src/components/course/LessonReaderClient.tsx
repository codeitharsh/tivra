'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronLeft, CheckCircle2, Circle, Clock,
  Menu, X, Award, Loader2, Check,
} from 'lucide-react'

interface TocLesson { id: string; title: string; lessonNumber: number; isRequired: boolean }
interface TocModule { id: string; title: string; moduleNumber: number; lessons: TocLesson[] }

interface Props {
  courseId: string
  courseSlug: string
  courseTitle: string
  isCertificateEnabled: boolean
  tocModules: TocModule[]
  currentLessonId: string
  currentLessonTitle: string
  currentLessonDuration: number
  currentModuleTitle: string
  prevLessonId: string | null
  nextLessonId: string | null
  initialCompletedLessonIds: string[]
  initialPercent: number
  initialTotalRequired: number
  initialCompletedRequired: number
  initialCourseComplete: boolean
  children: ReactNode
}

export default function LessonReaderClient({
  courseId, courseSlug, courseTitle, isCertificateEnabled, tocModules,
  currentLessonId, currentLessonTitle, currentLessonDuration, currentModuleTitle,
  prevLessonId, nextLessonId,
  initialCompletedLessonIds, initialPercent, initialTotalRequired, initialCompletedRequired,
  initialCourseComplete, children,
}: Props) {
  const router = useRouter()
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompletedLessonIds))
  const [percent, setPercent] = useState(initialPercent)
  const [totalRequired, setTotalRequired] = useState(initialTotalRequired)
  const [completedRequired, setCompletedRequired] = useState(initialCompletedRequired)
  const [courseComplete, setCourseComplete] = useState(initialCourseComplete)
  const [marking, setMarking] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  // Reset the "just completed" banner when navigating to a different
  // lesson — adjusted during render (React's recommended pattern for
  // state that depends on a changing prop) rather than in an effect, so
  // there's no stale-state flash and no cascading-render lint warning.
  const [lastSeenLessonId, setLastSeenLessonId] = useState(currentLessonId)
  if (currentLessonId !== lastSeenLessonId) {
    setLastSeenLessonId(currentLessonId)
    setJustCompleted(false)
  }

  const isComplete = completedIds.has(currentLessonId)

  // Resume-where-left-off bookkeeping — fire-and-forget, doesn't block
  // rendering the lesson.
  useEffect(() => {
    fetch('/api/course-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_last_lesson', courseId, lessonId: currentLessonId }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId])

  async function handleMarkComplete() {
    if (isComplete || marking) return
    setMarking(true)
    try {
      const res = await fetch('/api/course-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_lesson_complete', lessonId: currentLessonId }),
      })
      const data = await res.json() as {
        success?: boolean
        progress?: { percent: number; totalRequired: number; completedRequired: number }
        certificateIssued?: boolean
      }
      if (!res.ok || !data.success) throw new Error('Failed to mark complete')

      setCompletedIds(prev => new Set(prev).add(currentLessonId))
      if (data.progress) {
        setPercent(data.progress.percent)
        setTotalRequired(data.progress.totalRequired)
        setCompletedRequired(data.progress.completedRequired)
      }
      if (data.certificateIssued) setCourseComplete(true)
      setJustCompleted(true)
    } catch (err) {
      console.error('[LessonReaderClient] mark complete failed:', err)
    } finally {
      setMarking(false)
    }
  }

  const tocContent = (
    <div style={{ padding: '4px 0' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <Link href={`/courses/${courseSlug}`} style={{
          fontSize: '12px', color: 'var(--muted)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '10px',
        }}>
          <ChevronLeft size={12}/> {courseTitle}
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
          <span>Course progress</span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{percent}%</span>
        </div>
        <div style={{ height: '5px', borderRadius: '4px', background: 'var(--card2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent-2)', borderRadius: '4px' }}/>
        </div>
        {courseComplete && isCertificateEnabled && (
          <Link href={`/courses/${courseSlug}/certificate`} className="btn btn-ghost" style={{
            fontSize: '11px', marginTop: '10px', width: '100%', justifyContent: 'center',
          }}>
            <Award size={12}/> View certificate
          </Link>
        )}
      </div>
      {tocModules.map(m => (
        <div key={m.id} style={{ marginBottom: '4px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase',
            letterSpacing: '0.06em', padding: '10px 16px 4px',
          }}>
            Module {m.moduleNumber} · {m.title}
          </div>
          {m.lessons.map(l => {
            const active = l.id === currentLessonId
            const done = completedIds.has(l.id)
            return (
              <Link key={l.id} href={`/courses/${courseSlug}/learn/${l.id}`} style={{ textDecoration: 'none' }}>
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
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  {!l.isRequired && <span style={{ fontSize: '9px', color: 'var(--muted2)', flexShrink: 0 }}>Optional</span>}
                </div>
              </Link>
            )
          })}
        </div>
      ))}
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

      {/* ── Lesson content ── */}
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
            <Link href="/courses" style={{ color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}>Courses</Link>
            <ChevronRight size={12} style={{ flexShrink: 0 }}/>
            <Link href={`/courses/${courseSlug}`} style={{ color: 'var(--muted)', textDecoration: 'none', flexShrink: 0 }}>{courseTitle}</Link>
            <ChevronRight size={12} style={{ flexShrink: 0 }}/>
            <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentModuleTitle}</span>
          </div>
        </div>

        <div style={{ flex: 1, padding: '28px 28px 100px', maxWidth: '760px', width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: '18px' }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '24px', color: 'var(--text)', marginBottom: '8px',
            }}>
              {currentLessonTitle}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--muted2)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12}/> {currentLessonDuration} min
              </span>
              {isComplete && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--green)' }}>
                  <CheckCircle2 size={12}/> Completed
                </span>
              )}
            </div>
          </div>

          {children}

          <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
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
            {justCompleted && totalRequired > 0 && (
              <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--green)' }}>
                {completedRequired}/{totalRequired} required lessons done
              </span>
            )}
          </div>
        </div>

        {/* ── Prev/Next — sticky bottom bar ── */}
        <div style={{
          position: 'sticky', bottom: 0, borderTop: '1px solid var(--border)',
          background: 'var(--bg)', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', gap: '10px',
        }}>
          {prevLessonId ? (
            <button onClick={() => router.push(`/courses/${courseSlug}/learn/${prevLessonId}`)} className="btn btn-ghost" style={{ fontSize: '13px' }}>
              <ChevronLeft size={14}/> Previous
            </button>
          ) : <span/>}
          {nextLessonId ? (
            <button onClick={() => router.push(`/courses/${courseSlug}/learn/${nextLessonId}`)} className="btn btn-primary" style={{ fontSize: '13px' }}>
              Next <ChevronRight size={14}/>
            </button>
          ) : (
            <Link href={`/courses/${courseSlug}`} className="btn btn-primary" style={{ fontSize: '13px' }}>
              Finish course <ChevronRight size={14}/>
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
