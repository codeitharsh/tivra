export const runtime = 'edge'

import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import PublicNav from '@/components/PublicNav'
import { getCourseProgress } from '@/lib/course-progress'
import { courseAssetUrl } from '@/lib/course-assets'
import { isPaidCourse, hasPurchasedCourse } from '@/lib/course-access'
import CourseCheckout from '@/components/course/CourseCheckout'
import type { Profile } from '@/types/database'
import {
  Clock, Layers, BookOpen, Award, CheckCircle2, ChevronRight, ArrowRight,
  ClipboardList, Lock, ChevronDown, PlayCircle, FileText,
} from 'lucide-react'

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: 'Beginner',     color: 'var(--green-text)', bg: 'var(--green-dim)' },
  intermediate: { label: 'Intermediate', color: 'var(--amber-text)', bg: 'var(--amber-dim)' },
  advanced:     { label: 'Advanced',     color: 'var(--red-text)',   bg: 'var(--red-dim)' },
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
    .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills, learning_outcomes, is_certificate_enabled, cover_image_path, price_inr, original_price_inr, track_slug')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!courseRow) notFound()
  const course = courseRow as {
    id: string; slug: string; title: string; description: string | null
    difficulty: string; estimated_duration_minutes: number | null
    skills: string[]; learning_outcomes: string[]; is_certificate_enabled: boolean
    cover_image_path: string | null
    price_inr: number | null; original_price_inr: number | null; track_slug: string | null
  }

  const isPaid = isPaidCourse(course.price_inr)

  // Beginner <-> Intermediate pairing — siblings share track_slug.
  const { data: siblingsRaw } = course.track_slug ? await admin
    .from('courses')
    .select('slug, title, difficulty')
    .eq('track_slug', course.track_slug)
    .eq('status', 'published')
    .order('difficulty') : { data: [] }
  const siblings = (siblingsRaw ?? []) as { slug: string; title: string; difficulty: string }[]

  const { data: modulesRaw } = await admin
    .from('course_modules')
    .select('id, title, module_number')
    .eq('course_id', course.id)
    .order('module_number')

  const modules = (modulesRaw ?? []) as { id: string; title: string; module_number: number }[]
  const moduleIds = modules.map(m => m.id)

  const { data: lessonsRaw } = moduleIds.length > 0 ? await admin
    .from('course_lessons')
    .select('id, module_id, lesson_number, title, estimated_duration_minutes, is_required')
    .in('module_id', moduleIds)
    .order('lesson_number') : { data: [] }

  const lessons = (lessonsRaw ?? []) as {
    id: string; module_id: string; lesson_number: number; title: string
    estimated_duration_minutes: number; is_required: boolean
  }[]
  const lessonsByModule: Record<string, typeof lessons> = {}
  for (const l of lessons) (lessonsByModule[l.module_id] ??= []).push(l)
  for (const modId in lessonsByModule) lessonsByModule[modId].sort((a, b) => a.lesson_number - b.lesson_number)

  // lessons is only ordered by lesson_number, which resets to 1 in every
  // module — so lessons[0] could be any module's first lesson, not
  // necessarily module 1's. Re-flatten in true module -> lesson order
  // (same approach as the lesson reader page) before taking the first one.
  const orderedLessons: { id: string; module_id: string }[] = []
  for (const m of modules) {
    for (const l of (lessonsByModule[m.id] ?? [])) orderedLessons.push(l)
  }
  const firstLessonId = orderedLessons[0]?.id ?? null

  const { data: quizzesRaw } = await admin
    .from('course_quizzes')
    .select('id, title, module_id, quiz_type')
    .eq('course_id', course.id)
  const quizzes = (quizzesRaw ?? []) as {
    id: string; title: string; module_id: string | null; quiz_type: 'module_test' | 'final_assessment'
  }[]

  // Personalized state — only fetched for a logged-in visitor.
  let resumeLessonId = firstLessonId
  let progress: { percent: number; totalRequired: number; completedRequired: number; completedLessonIds: Set<string> } | null = null
  let isComplete = false
  let purchased = !isPaid
  let nextQuiz: { id: string; title: string } | null = null

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

    if (isPaid) purchased = await hasPurchasedCourse(admin, user.id, course.id)

    if (quizzes.length > 0) {
      const { data: passedRaw } = await admin
        .from('course_quiz_attempts')
        .select('quiz_id')
        .eq('student_id', user.id)
        .eq('passed', true)
        .in('quiz_id', quizzes.map(q => q.id))
      const passedIds = new Set(((passedRaw ?? []) as { quiz_id: string }[]).map(a => a.quiz_id))

      // Whichever quiz the student should tackle next: any module test
      // for an already-finished module first (in module order), then
      // the final assessment once everything else is done. Doesn't
      // re-verify unlock state here (the quiz page itself does, via
      // isQuizUnlocked) — this is just picking which one to link to.
      const moduleTests = quizzes.filter(q => q.quiz_type === 'module_test')
      const finalAssessment = quizzes.find(q => q.quiz_type === 'final_assessment') ?? null
      const pendingModuleTest = moduleTests.find(q => !passedIds.has(q.id))
      const finalPending = !!finalAssessment && !passedIds.has(finalAssessment.id)
        && moduleTests.every(q => passedIds.has(q.id))

      nextQuiz = pendingModuleTest ?? (finalPending ? finalAssessment : null)
    }

    const { data: completionRow } = await admin
      .from('course_completions')
      .select('id')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle()
    isComplete = !!completionRow
  }

  const diff = DIFFICULTY_META[course.difficulty] ?? DIFFICULTY_META.beginner
  const totalLessons = lessons.length

  const buyCard = (
    <div className="card" style={{ padding: '22px', position: 'sticky', top: '20px' }}>
      {course.cover_image_path && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '18px' }}>
          <Image src={courseAssetUrl(course.cover_image_path)} alt={course.title} fill priority style={{ objectFit: 'cover', objectPosition: 'top' }}/>
        </div>
      )}

      {user && progress && progress.totalRequired > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
            <span>Your progress</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{progress.percent}%</span>
          </div>
          <div style={{ height: '6px', borderRadius: '4px', background: 'var(--card2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress.percent}%`, background: 'var(--accent-2)', borderRadius: '4px' }}/>
          </div>
        </div>
      )}

      {isPaid && !purchased ? (
        user ? (
          <CourseCheckout
            courseSlug={course.slug}
            courseTitle={course.title}
            priceInr={course.price_inr!}
            originalPriceInr={course.original_price_inr}
          />
        ) : (
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '24px', color: 'var(--text)', marginBottom: '14px' }}>
              {course.original_price_inr && course.original_price_inr > course.price_inr! && (
                <span style={{ fontSize: '15px', color: 'var(--muted2)', textDecoration: 'line-through', marginRight: '10px' }}>
                  ₹{course.original_price_inr.toLocaleString('en-IN')}
                </span>
              )}
              ₹{course.price_inr!.toLocaleString('en-IN')}
            </div>
            <Link href={`/login?next=/courses/${course.slug}`} className="btn btn-primary" style={{ fontSize: '13px', width: '100%', justifyContent: 'center' }}>
              <Lock size={13}/> Log in to buy
            </Link>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {nextQuiz ? (
            <>
              <Link href={`/courses/${course.slug}/quiz/${nextQuiz.id}`} className="btn btn-primary" style={{ fontSize: '13px', width: '100%', justifyContent: 'center' }}>
                <ClipboardList size={13}/> {nextQuiz.title} <ArrowRight size={13}/>
              </Link>
              {resumeLessonId && (
                <Link href={`/courses/${course.slug}/learn/${resumeLessonId}`} className="btn btn-ghost" style={{ fontSize: '13px', width: '100%', justifyContent: 'center' }}>
                  Review lessons
                </Link>
              )}
            </>
          ) : resumeLessonId ? (
            // A plain link, not a click-to-enroll button — visiting the
            // lesson itself is what creates the enrollment record (see
            // set_last_lesson in LessonReaderClient), and for a logged-
            // out visitor this link is exactly what the middleware uses
            // to redirect to /login and bounce them straight back here
            // afterwards (STEP 2's `next` param). No separate "enroll
            // first" step needed for either case.
            <Link href={`/courses/${course.slug}/learn/${resumeLessonId}`} className="btn btn-primary" style={{ fontSize: '13px', width: '100%', justifyContent: 'center' }}>
              {user && resumeLessonId !== firstLessonId ? 'Continue learning' : 'Start course'} <ArrowRight size={13}/>
            </Link>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>This course has no lessons yet.</span>
          )}
          {isComplete && course.is_certificate_enabled && (
            <Link href={`/courses/${course.slug}/certificate`} className="btn btn-ghost" style={{ fontSize: '13px', width: '100%', justifyContent: 'center' }}>
              <Award size={13}/> View certificate
            </Link>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
          This course includes
        </div>
        {[
          { icon: Clock, label: course.estimated_duration_minutes ? `${Math.round(course.estimated_duration_minutes / 60)} hours of content` : 'Self-paced content' },
          { icon: Layers, label: `${modules.length} module${modules.length !== 1 ? 's' : ''}` },
          { icon: BookOpen, label: `${totalLessons} lesson${totalLessons !== 1 ? 's' : ''}` },
          ...(course.is_certificate_enabled ? [{ icon: Award, label: 'Certificate of completion' }] : []),
        ].map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--muted)' }}>
            <f.icon size={14} color="var(--muted2)"/> {f.label}
          </div>
        ))}
      </div>
    </div>
  )

  const body = (
    <div style={{ padding: '28px', maxWidth: '1120px', margin: '0 auto', width: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>
        <Link href="/courses" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Courses</Link>
        <ChevronRight size={13}/>
        <span style={{ color: 'var(--text)' }}>{course.title}</span>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span className="pill" style={{ background: diff.bg, color: diff.color }}>{diff.label}</span>
          <span className="pill" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
            <Layers size={11} style={{ marginRight: '4px' }}/> {modules.length} module{modules.length !== 1 ? 's' : ''}
          </span>
          <span className="pill" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
            <BookOpen size={11} style={{ marginRight: '4px' }}/> {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
          </span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(28px,3.5vw,38px)', color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '12px' }}>
          {course.title}
        </h1>

        {siblings.length > 1 && (
          <div style={{
            display: 'inline-flex', padding: '3px', borderRadius: 'var(--radius-pill)',
            background: 'var(--card2)', border: '1px solid var(--border)', marginBottom: '16px', gap: '2px',
          }}>
            {siblings.map(s => {
              const active = s.slug === course.slug
              const meta = DIFFICULTY_META[s.difficulty] ?? DIFFICULTY_META.beginner
              return (
                <Link key={s.slug} href={`/courses/${s.slug}`} style={{
                  textDecoration: 'none', fontSize: '12px', fontWeight: 600, padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  background: active ? meta.bg : 'transparent',
                  color: active ? meta.color : 'var(--muted)',
                }}>
                  {meta.label}
                </Link>
              )
            })}
          </div>
        )}

        {course.description && (
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '640px' }}>
            {course.description}
          </p>
        )}
      </div>

      <div className="r-split course-detail-split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {course.learning_outcomes.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '16px' }}>
                What you&apos;ll learn
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '12px 20px' }}>
                {course.learning_outcomes.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                    <CheckCircle2 size={15} color="var(--green-text)" style={{ flexShrink: 0, marginTop: '1px' }}/>
                    {o}
                  </div>
                ))}
              </div>
            </div>
          )}

          {course.skills.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '16px' }}>
                Skills you&apos;ll gain
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {course.skills.map(s => (
                  <Link key={s} href={`/explore?skill=${encodeURIComponent(s)}`} style={{
                    fontSize: '13px', padding: '6px 14px', borderRadius: '20px', textDecoration: 'none',
                    background: 'var(--accent-2-dim)', color: 'var(--accent-2)', fontWeight: 500,
                  }}>{s}</Link>
                ))}
              </div>
            </div>
          )}

          {/* Syllabus — native <details>/<summary> accordion, zero client JS */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)' }}>
                Course content
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                {modules.length} modules · {totalLessons} lessons
              </div>
            </div>
            {modules.map((m, i) => {
              const moduleLessons = lessonsByModule[m.id] ?? []
              return (
                <details key={m.id} open={i === 0} style={{ borderBottom: i < modules.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <summary className="syllabus-summary" style={{
                    padding: '16px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    listStyle: 'none',
                  }}>
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                      background: 'var(--card2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
                    }}>{m.module_number}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', flex: 1 }}>{m.title}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted2)', flexShrink: 0 }}>
                      {moduleLessons.length} lesson{moduleLessons.length !== 1 ? 's' : ''}
                    </span>
                    <ChevronDown size={15} className="syllabus-chevron" style={{ color: 'var(--muted)', flexShrink: 0 }}/>
                  </summary>
                  <div style={{ padding: '0 24px 14px 62px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {moduleLessons.map(l => {
                      const done = progress?.completedLessonIds.has(l.id)
                      return (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', fontSize: '13px' }}>
                          {done ? <CheckCircle2 size={14} color="var(--green-text)" style={{ flexShrink: 0 }}/> : <PlayCircle size={14} color="var(--muted2)" style={{ flexShrink: 0 }}/>}
                          <span style={{ flex: 1, color: done ? 'var(--muted)' : 'var(--text)' }}>{l.title}</span>
                          {!l.is_required && <span style={{ fontSize: '11px', color: 'var(--muted2)' }}>Optional</span>}
                          <span style={{ fontSize: '11px', color: 'var(--muted2)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10}/> {l.estimated_duration_minutes}m
                          </span>
                        </div>
                      )
                    })}
                    {moduleLessons.length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--muted2)', padding: '8px 0' }}>No lessons yet.</div>
                    )}
                  </div>
                </details>
              )
            })}
            {modules.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <FileText size={22} color="var(--muted2)" style={{ marginBottom: '8px' }}/>
                <div>No modules added yet.</div>
              </div>
            )}
          </div>
        </div>

        <div>{buyCard}</div>
      </div>

      <style>{`
        .syllabus-summary::-webkit-details-marker { display: none; }
        details[open] .syllabus-chevron { transform: rotate(180deg); }
        .syllabus-chevron { transition: transform 0.2s ease; }
        @media (max-width: 860px) {
          .course-detail-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )

  if (profile) {
    return (
      <AuthShell profile={profile} title={course.title} subtitle="Self-paced course" noContainer>
        {body}
      </AuthShell>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      {body}
    </div>
  )
}
