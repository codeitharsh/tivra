import Image from 'next/image'
import Link from 'next/link'
import { courseAssetUrl } from '@/lib/course-assets'
import { Clock, ArrowRight, BarChart3, Check } from 'lucide-react'

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: 'Beginner',     color: 'var(--green-text)', bg: 'var(--green-dim)' },
  intermediate: { label: 'Intermediate', color: 'var(--amber-text)', bg: 'var(--amber-dim)' },
  advanced:     { label: 'Advanced',     color: 'var(--red-text)',   bg: 'var(--red-dim)' },
}

export interface CourseCardData {
  id: string; slug: string; title: string; description: string | null
  difficulty: string; estimated_duration_minutes: number | null; skills: string[]
  cover_image_path: string | null
  price_inr: number | null; original_price_inr: number | null
}

// Shared course-card visual, used by /explore, /courses, and the
// dashboard's My Courses / Recommended sections — one rich card design
// (big cover image, floating badges, consistent footer) instead of the
// same markup hand-copied in three places with three different levels of
// visual polish.
export default function CourseCard({
  course, progressPercent, enrolled,
}: {
  course: CourseCardData
  progressPercent?: number
  enrolled?: boolean
}) {
  const diff = DIFFICULTY_META[course.difficulty] ?? DIFFICULTY_META.beginner
  const isComplete = progressPercent === 100
  const inProgress = progressPercent !== undefined && progressPercent > 0 && progressPercent < 100

  return (
    <Link href={`/courses/${course.slug}`} className="course-card-link" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div className="card course-card" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="course-card-media" style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: 'var(--card2)' }}>
          {course.cover_image_path ? (
            <Image
              src={courseAssetUrl(course.cover_image_path)} alt={course.title} fill
              className="course-card-img"
              style={{ objectFit: 'cover', objectPosition: 'top' }}
              sizes="(max-width: 768px) 100vw, 360px"
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, var(--accent-2-dim), var(--card2))',
            }}/>
          )}
          <span className="pill" style={{
            position: 'absolute', top: '12px', left: '12px',
            background: diff.bg, color: diff.color, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}>{diff.label}</span>
          {course.price_inr && course.price_inr > 0 ? (
            <span style={{
              position: 'absolute', top: '12px', right: '12px',
              display: 'flex', alignItems: 'baseline', gap: '5px',
              padding: '4px 10px', borderRadius: 'var(--radius-pill)',
              background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
            }}>
              {course.original_price_inr && course.original_price_inr > course.price_inr && (
                <span style={{ fontSize: '11px', color: 'var(--muted2)', textDecoration: 'line-through' }}>
                  ₹{course.original_price_inr.toLocaleString('en-IN')}
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                ₹{course.price_inr.toLocaleString('en-IN')}
              </span>
            </span>
          ) : (
            <span className="pill" style={{
              position: 'absolute', top: '12px', right: '12px',
              background: 'rgba(255,255,255,0.94)', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
            }}>Free</span>
          )}
          {progressPercent !== undefined && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(0,0,0,0.15)' }}>
              <div style={{ height: '100%', width: `${progressPercent}%`, background: isComplete ? 'var(--green)' : 'var(--accent-2)' }}/>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', color: 'var(--text)',
            marginBottom: '6px', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {course.title}
          </div>
          {course.description && (
            <p style={{
              fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55, marginBottom: '12px', flex: 1,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {course.description}
            </p>
          )}
          {course.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {course.skills.slice(0, 3).map(s => (
                <span key={s} style={{
                  fontSize: '11px', padding: '3px 9px', borderRadius: '20px',
                  background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--muted)',
                }}>{s}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '4px' }}>
            {course.estimated_duration_minutes ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--muted2)' }}>
                <Clock size={12}/> {Math.round(course.estimated_duration_minutes / 60)}h
              </span>
            ) : <span/>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-2)' }}>
              {isComplete ? <><Check size={13}/> Completed</>
                : inProgress ? <><BarChart3 size={13}/> {progressPercent}% · Continue</>
                : enrolled ? <>Continue <ArrowRight size={13}/></>
                : <>View course <ArrowRight size={13}/></>}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
