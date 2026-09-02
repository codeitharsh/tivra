export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import { Download, ExternalLink, GraduationCap, Users, CheckCircle2 } from 'lucide-react'

// Self-paced courses have no exam/score — completion is purely "did the
// student finish every required lesson" (see migrations/2026-08-24-self-
// paced-courses.sql), so this page reports lesson-progress and
// completion, not a score, unlike the phase-certificate/assessment admin
// views elsewhere which do have a score_percent to show.

interface EnrollmentRow {
  id: string; student_id: string; enrolled_at: string
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
}
interface CompletionRow {
  id: string; student_id: string; completed_lesson_count: number
  total_required_lesson_count: number; issued_at: string
  verification_code: string; is_revoked: boolean
}

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

export default async function CourseLearnersPage({
  params,
}: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: courseRow } = await admin.from('courses').select('id, title, slug').eq('id', courseId).maybeSingle()
  if (!courseRow) notFound()
  const course = courseRow as { id: string; title: string; slug: string }

  // Course-wide required-lesson count — the same denominator every
  // enrolled student's progress is measured against.
  const { data: modulesRaw } = await admin.from('course_modules').select('id').eq('course_id', courseId)
  const moduleIds = ((modulesRaw ?? []) as { id: string }[]).map(m => m.id)

  const { data: lessonsRaw } = moduleIds.length > 0 ? await admin
    .from('course_lessons').select('id, is_required').in('module_id', moduleIds) : { data: [] }
  const lessons = (lessonsRaw ?? []) as { id: string; is_required: boolean }[]
  const requiredLessonIds = lessons.filter(l => l.is_required).map(l => l.id)
  const totalRequired = requiredLessonIds.length

  const { data: enrollmentsRaw } = await admin
    .from('course_enrollments')
    .select('id, student_id, enrolled_at, profiles!student_id(full_name, email)')
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: false })
  const enrollments = (enrollmentsRaw ?? []) as EnrollmentRow[]

  // Bulk progress lookup — one query for every enrolled student's
  // completed-required-lesson count, instead of N+1 calls into
  // getCourseProgress (which is written for a single student at a time).
  const studentIds = enrollments.map(e => e.student_id)
  const { data: progressRaw } = (studentIds.length > 0 && requiredLessonIds.length > 0) ? await admin
    .from('course_lesson_progress')
    .select('student_id, lesson_id')
    .in('student_id', studentIds)
    .in('lesson_id', requiredLessonIds) : { data: [] }

  const completedCountByStudent: Record<string, number> = {}
  for (const p of (progressRaw ?? []) as { student_id: string; lesson_id: string }[]) {
    completedCountByStudent[p.student_id] = (completedCountByStudent[p.student_id] ?? 0) + 1
  }

  const { data: completionsRaw } = await admin
    .from('course_completions')
    .select('id, student_id, completed_lesson_count, total_required_lesson_count, issued_at, verification_code, is_revoked')
    .eq('course_id', courseId)
  const completionByStudent: Record<string, CompletionRow> = {}
  for (const c of (completionsRaw ?? []) as CompletionRow[]) completionByStudent[c.student_id] = c

  const completedCount = enrollments.filter(e => completionByStudent[e.student_id] && !completionByStudent[e.student_id].is_revoked).length
  const completionRate = enrollments.length === 0 ? 0 : Math.round((completedCount / enrollments.length) * 100)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title={course.title} subtitle="Learners, progress & certificates"/>
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

          <div style={{ marginBottom: '16px' }}>
            <Link href={`/admin/courses/${course.id}`} style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
              ← Back to modules & lessons
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Users size={14} color="var(--accent-2)"/>
                <span className="stat-label">Enrolled</span>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px' }}>{enrollments.length}</div>
            </div>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <CheckCircle2 size={14} color="var(--green)"/>
                <span className="stat-label">Completed</span>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px' }}>{completedCount}</div>
            </div>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <GraduationCap size={14} color="var(--amber, #f59e0b)"/>
                <span className="stat-label">Completion rate</span>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px' }}>{completionRate}%</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Progress</th>
                    <th>Enrolled</th>
                    <th>Status</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>No one has enrolled yet.</td></tr>
                  )}
                  {enrollments.map(e => {
                    const p = one(e.profiles)
                    const completed = completedCountByStudent[e.student_id] ?? 0
                    const pct = totalRequired === 0 ? 0 : Math.round((completed / totalRequired) * 100)
                    const completion = completionByStudent[e.student_id]
                    const isComplete = !!completion && !completion.is_revoked
                    return (
                      <tr key={e.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{p?.full_name ?? '—'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p?.email ?? '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px' }}>{completed}/{totalRequired} lessons · {pct}%</div>
                          <div style={{ height: '4px', borderRadius: '3px', background: 'var(--card2)', overflow: 'hidden', marginTop: '4px', width: '100px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: isComplete ? 'var(--green)' : 'var(--accent-2)', borderRadius: '3px' }}/>
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--muted)' }}>
                          {new Date(e.enrolled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          {isComplete
                            ? <span className="pill" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>Completed</span>
                            : <span className="pill" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>In progress</span>}
                        </td>
                        <td>
                          {isComplete ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a href={`/api/course-completion-certificate/${completion.id}`} target="_blank" rel="noreferrer"
                                title="Download certificate PDF" style={{ color: 'var(--accent-2)' }}>
                                <Download size={15}/>
                              </a>
                              <a href={`/verify/${completion.verification_code}`} target="_blank" rel="noreferrer"
                                title="Verify certificate" style={{ color: 'var(--muted)' }}>
                                <ExternalLink size={15}/>
                              </a>
                            </div>
                          ) : <span style={{ color: 'var(--muted2)', fontSize: '13px' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
