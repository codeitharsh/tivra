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
