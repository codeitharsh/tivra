// Single source of truth for "what % of this course has a student
// completed" — computed dynamically from real row counts every time,
// never stored/trusted as a client-supplied value. Centralizing this here
// avoids repeating the exact mistake found in the paid-programme code,
// where percent-complete is computed three different, inconsistent ways
// (two of which hardcode /24 as the denominator).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CourseProgress {
  totalRequired: number
  completedRequired: number
  percent: number
  completedLessonIds: Set<string>
}

const EMPTY: CourseProgress = {
  totalRequired: 0, completedRequired: 0, percent: 0, completedLessonIds: new Set(),
}

export async function getCourseProgress(
  sb: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<CourseProgress> {
  const { data: modulesRaw } = await sb
    .from('course_modules')
    .select('id')
    .eq('course_id', courseId)

  const moduleIds = ((modulesRaw ?? []) as { id: string }[]).map(m => m.id)
  if (moduleIds.length === 0) return { ...EMPTY, completedLessonIds: new Set() }

  const { data: lessonsRaw } = await sb
    .from('course_lessons')
    .select('id, is_required')
    .in('module_id', moduleIds)

  const lessons = (lessonsRaw ?? []) as { id: string; is_required: boolean }[]
  if (lessons.length === 0) return { ...EMPTY, completedLessonIds: new Set() }

  const requiredLessonIds = lessons.filter(l => l.is_required).map(l => l.id)
  const totalRequired = requiredLessonIds.length

  const { data: progressRaw } = await sb
    .from('course_lesson_progress')
    .select('lesson_id')
    .eq('student_id', studentId)
    .in('lesson_id', lessons.map(l => l.id))

  const completedLessonIds = new Set(
    ((progressRaw ?? []) as { lesson_id: string }[]).map(p => p.lesson_id)
  )
  const completedRequired = requiredLessonIds.filter(id => completedLessonIds.has(id)).length
  const percent = totalRequired === 0 ? 0 : Math.round((completedRequired / totalRequired) * 100)

  return { totalRequired, completedRequired, percent, completedLessonIds }
}

// Same computation as getCourseProgress, scoped to a single module —
// used to gate a per-module test (course_quizzes.module_id set) on just
// that module's lessons, rather than the whole course.
export async function getModuleProgress(
  sb: SupabaseClient,
  studentId: string,
  moduleId: string
): Promise<{ totalRequired: number; completedRequired: number }> {
  const { data: lessonsRaw } = await sb
    .from('course_lessons')
    .select('id, is_required')
    .eq('module_id', moduleId)

  const lessons = (lessonsRaw ?? []) as { id: string; is_required: boolean }[]
  const requiredLessonIds = lessons.filter(l => l.is_required).map(l => l.id)
  const totalRequired = requiredLessonIds.length
  if (totalRequired === 0) return { totalRequired: 0, completedRequired: 0 }

  const { data: progressRaw } = await sb
    .from('course_lesson_progress')
    .select('lesson_id')
    .eq('student_id', studentId)
    .in('lesson_id', requiredLessonIds)

  const completedRequired = (progressRaw ?? []).length
  return { totalRequired, completedRequired }
}

// Shared by the quiz-taking page and submit-course-quiz, so the unlock
// rule can never drift between "can the student see this quiz" and "can
// the student actually submit it": a module test unlocks once that
// module's own lessons are done; the final assessment unlocks once
// every lesson in the course AND every module test are done.
export async function isQuizUnlocked(
  sb: SupabaseClient,
  studentId: string,
  quiz: { course_id: string; module_id: string | null; quiz_type: string }
): Promise<boolean> {
  if (quiz.quiz_type === 'module_test' && quiz.module_id) {
    const moduleProgress = await getModuleProgress(sb, studentId, quiz.module_id)
    return moduleProgress.totalRequired > 0 && moduleProgress.completedRequired >= moduleProgress.totalRequired
  }

  const courseProgress = await getCourseProgress(sb, studentId, quiz.course_id)
  const allLessonsDone = courseProgress.totalRequired > 0 && courseProgress.completedRequired >= courseProgress.totalRequired

  const { data: moduleTestsRaw } = await sb
    .from('course_quizzes')
    .select('id')
    .eq('course_id', quiz.course_id)
    .eq('quiz_type', 'module_test')

  const moduleTests = (moduleTestsRaw ?? []) as { id: string }[]
  if (moduleTests.length === 0) return allLessonsDone

  const { data: passedRaw } = await sb
    .from('course_quiz_attempts')
    .select('quiz_id')
    .eq('student_id', studentId)
    .eq('passed', true)
    .in('quiz_id', moduleTests.map(m => m.id))

  const passedIds = new Set(((passedRaw ?? []) as { quiz_id: string }[]).map(a => a.quiz_id))
  const allModuleTestsPassed = moduleTests.every(m => passedIds.has(m.id))

  return allLessonsDone && allModuleTestsPassed
}
