export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import LessonBlockRenderer from '@/components/course/LessonBlockRenderer'
import LessonReaderClient from '@/components/course/LessonReaderClient'
import { getCourseProgress } from '@/lib/course-progress'
import type { Profile } from '@/types/database'
import type { CourseBlock } from '@/types/course'

interface LessonRow {
  id: string; module_id: string; title: string; lesson_number: number
  is_required: boolean; estimated_duration_minutes: number; content: CourseBlock[]
}
interface ModuleRow { id: string; title: string; module_number: number }

export default async function LessonReaderPage({
  params,
}: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const { data: courseRow } = await admin
    .from('courses')
    .select('id, slug, title, is_certificate_enabled')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!courseRow) notFound()
  const course = courseRow as { id: string; slug: string; title: string; is_certificate_enabled: boolean }

  const { data: modulesRaw } = await admin
    .from('course_modules')
    .select('id, title, module_number')
    .eq('course_id', course.id)
    .order('module_number')
  const modules = (modulesRaw ?? []) as ModuleRow[]
  const moduleIds = modules.map(m => m.id)

  const { data: lessonsRaw } = moduleIds.length > 0 ? await admin
    .from('course_lessons')
    .select('id, module_id, title, lesson_number, is_required, estimated_duration_minutes, content')
    .in('module_id', moduleIds)
    .order('lesson_number') : { data: [] }
  const lessons = (lessonsRaw ?? []) as LessonRow[]

  // Flatten in module → lesson order to compute prev/next and to verify
  // this lessonId genuinely belongs to this course (defense in depth
  // against an IDOR — same reasoning as the paid content viewer's
  // module/programme cross-check).
  const orderedLessons: LessonRow[] = []
  for (const m of modules) {
    for (const l of lessons.filter(l => l.module_id === m.id).sort((a, b) => a.lesson_number - b.lesson_number)) {
      orderedLessons.push(l)
    }
  }

  const currentIndex = orderedLessons.findIndex(l => l.id === lessonId)
  if (currentIndex === -1) notFound()
  const currentLesson = orderedLessons[currentIndex]
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < orderedLessons.length - 1 ? orderedLessons[currentIndex + 1] : null

  const progress = await getCourseProgress(admin, user.id, course.id)

  const { data: completionRow } = await admin
    .from('course_completions')
    .select('id')
    .eq('student_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()

  const tocModules = modules.map(m => ({
    id: m.id,
    title: m.title,
    moduleNumber: m.module_number,
    lessons: lessons
      .filter(l => l.module_id === m.id)
      .sort((a, b) => a.lesson_number - b.lesson_number)
      .map(l => ({
        id: l.id, title: l.title, lessonNumber: l.lesson_number, isRequired: l.is_required,
      })),
  }))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <LessonReaderClient
        courseId={course.id}
        courseSlug={course.slug}
        courseTitle={course.title}
        isCertificateEnabled={course.is_certificate_enabled}
        tocModules={tocModules}
        currentLessonId={currentLesson.id}
        currentLessonTitle={currentLesson.title}
        currentLessonDuration={currentLesson.estimated_duration_minutes}
        currentModuleTitle={modules.find(m => m.id === currentLesson.module_id)?.title ?? ''}
        prevLessonId={prevLesson?.id ?? null}
        nextLessonId={nextLesson?.id ?? null}
        initialCompletedLessonIds={Array.from(progress.completedLessonIds)}
        initialPercent={progress.percent}
        initialTotalRequired={progress.totalRequired}
        initialCompletedRequired={progress.completedRequired}
        initialCourseComplete={!!completionRow}
      >
        <LessonBlockRenderer blocks={currentLesson.content ?? []}/>
      </LessonReaderClient>
    </div>
  )
}
