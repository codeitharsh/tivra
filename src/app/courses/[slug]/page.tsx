export const runtime = 'edge'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import PublicNav from '@/components/PublicNav'
import { getCourseProgress } from '@/lib/course-progress'
import type { Profile } from '@/types/database'
import { Clock, Layers, BookOpen, Award, CheckCircle2, ChevronRight, ArrowRight } from 'lucide-react'

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: 'Beginner',     color: 'var(--green)', bg: 'var(--green-dim)' },
  intermediate: { label: 'Intermediate', color: '#f59e0b',      bg: 'rgba(245,158,11,0.1)' },
  advanced:     { label: 'Advanced',     color: 'var(--red)',   bg: 'var(--red-dim)' },
}

export default async function CourseLandingPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Browsing a course's landing page is public (middleware.ts STEP 1c) —
  // only /learn/[lessonId] and /certificate require login. So the user
  // lookup here is optional: it only decides which chrome to show and
  // whether to fetch/display personal progress.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile: Profile | null = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = p as Profile | null
  }

  const admin = createAdminClient()
  const { data: courseRow } = await admin
    .from('courses')
    .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills, learning_outcomes, is_certificate_enabled')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!courseRow) notFound()
  const course = courseRow as {
    id: string; slug: string; title: string; description: string | null
    difficulty: string; estimated_duration_minutes: number | null
    skills: string[]; learning_outcomes: string[]; is_certificate_enabled: boolean
  }

  const { data: modulesRaw } = await admin
    .from('course_modules')
    .select('id, title, module_number')
    .eq('course_id', course.id)
    .order('module_number')

  const modules = (modulesRaw ?? []) as { id: string; title: string; module_number: number }[]
  const moduleIds = modules.map(m => m.id)

  const { data: lessonsRaw } = moduleIds.length > 0 ? await admin
    .from('course_lessons')
    .select('id, module_id, lesson_number')
    .in('module_id', moduleIds)
    .order('lesson_number') : { data: [] }

  const lessons = (lessonsRaw ?? []) as { id: string; module_id: string; lesson_number: number }[]
  const lessonCountByModule: Record<string, number> = {}
  for (const l of lessons) lessonCountByModule[l.module_id] = (lessonCountByModule[l.module_id] ?? 0) + 1

  const firstLessonId = lessons[0]?.id ?? null

  // Personalized state — only fetched for a logged-in visitor.
  let resumeLessonId = firstLessonId
  let progress: { percent: number; totalRequired: number } | null = null
  let isComplete = false

  if (user) {
    const { data: enrollmentRow } = await admin
      .from('course_enrollments')
      .select('last_lesson_id')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle()

    const lastLessonId = (enrollmentRow as { last_lesson_id: string | null } | null)?.last_lesson_id ?? null
    resumeLessonId = lastLessonId ?? firstLessonId

    progress = await getCourseProgress(admin, user.id, course.id)

    const { data: completionRow } = await admin
      .from('course_completions')
      .select('id')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle()
    isComplete = !!completionRow
  }

  const diff = DIFFICULTY_META[course.difficulty] ?? DIFFICULTY_META.beginner

  const body = (
    <div style={{ padding: '28px', maxWidth: '840px', margin: '0 auto', width: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>
        <Link href="/courses" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Courses</Link>
        <ChevronRight size={13}/>
        <span style={{ color: 'var(--text)' }}>{course.title}</span>
      </div>

      <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span className="pill" style={{ background: diff.bg, color: diff.color }}>{diff.label}</span>
          {course.estimated_duration_minutes && (
            <span className="pill" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
              <Clock size={11} style={{ marginRight: '4px' }}/> {Math.round(course.estimated_duration_minutes / 60)}h estimated
            </span>
          )}
          <span className="pill" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
            <Layers size={11} style={{ marginRight: '4px' }}/> {modules.length} module{modules.length !== 1 ? 's' : ''}
          </span>
          <span className="pill" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
            <BookOpen size={11} style={{ marginRight: '4px' }}/> {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
          </span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px', color: 'var(--text)', marginBottom: '10px' }}>
          {course.title}
        </h1>
        {course.description && (
          <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '20px' }}>
            {course.description}
          </p>
        )}

        {course.skills.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Skills covered
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {course.skills.map(s => (
                <span key={s} style={{
                  fontSize: '12px', padding: '4px 11px', borderRadius: '20px',
                  background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {course.learning_outcomes.length > 0 && (
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              What you&apos;ll learn
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {course.learning_outcomes.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text)' }}>
                  <CheckCircle2 size={14} color="var(--green)" style={{ flexShrink: 0, marginTop: '2px' }}/>
                  {o}
                </div>
              ))}
            </div>
          </div>
        )}

        {user && progress && progress.totalRequired > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
              <span>Your progress</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{progress.percent}%</span>
            </div>
            <div style={{ height: '6px', borderRadius: '4px', background: 'var(--card2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress.percent}%`, background: 'var(--accent-2)', borderRadius: '4px' }}/>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {resumeLessonId ? (
            // A plain link, not a click-to-enroll button — visiting the
            // lesson itself is what creates the enrollment record (see
            // set_last_lesson in LessonReaderClient), and for a logged-
            // out visitor this link is exactly what the middleware uses
            // to redirect to /login and bounce them straight back here
            // afterwards (STEP 2's `next` param). No separate "enroll
            // first" step needed for either case.
            <Link href={`/courses/${course.slug}/learn/${resumeLessonId}`} className="btn btn-primary" style={{ fontSize: '13px' }}>
              {user && resumeLessonId !== firstLessonId ? 'Continue learning' : 'Start course'} <ArrowRight size={13}/>
            </Link>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>This course has no lessons yet.</span>
          )}
          {isComplete && course.is_certificate_enabled && (
            <Link href={`/courses/${course.slug}/certificate`} className="btn btn-ghost" style={{ fontSize: '13px' }}>
              <Award size={13}/> View certificate
            </Link>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {modules.map((m, i) => (
          <div key={m.id} style={{
            padding: '16px 22px', borderBottom: i < modules.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--card2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
              }}>{m.module_number}</span>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{m.title}</div>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--muted2)' }}>
                {lessonCountByModule[m.id] ?? 0} lesson{(lessonCountByModule[m.id] ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (profile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar profile={profile}/>
        <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
          <Topbar title={course.title} subtitle="Self-paced course"/>
          {body}
        </main>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      {body}
    </div>
  )
}
