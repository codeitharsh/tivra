// Mirrors src/lib/program-completion.ts's checkAndIssueProgramCompletion —
// same shape, same "compute from real rows, never trust a client percent"
// posture, targeting course_completions instead of program_completions.
// Called from POST /api/course-progress right after a lesson-completion
// write, safe to call defensively even when nothing is complete yet.

import { createClient as createSB, type SupabaseClient } from '@supabase/supabase-js'
import { getCourseProgress } from './course-progress'

interface CourseCompletionResult {
  issued: boolean
  alreadyHad?: boolean
}

export async function checkAndIssueCourseCompletion(
  sb: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<CourseCompletionResult> {
  const { data: courseRow } = await sb
    .from('courses')
    .select('slug, title, is_certificate_enabled')
    .eq('id', courseId)
    .maybeSingle()

  const course = courseRow as { slug: string; title: string; is_certificate_enabled: boolean } | null
  if (!course || !course.is_certificate_enabled) return { issued: false }

  const { data: existing } = await sb
    .from('course_completions')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (existing) return { issued: false, alreadyHad: true }

  const progress = await getCourseProgress(sb, studentId, courseId)
  if (progress.totalRequired === 0 || progress.completedRequired < progress.totalRequired) {
    return { issued: false }
  }

  // onConflict guards against a race if two requests trigger this near-
  // simultaneously (e.g. two tabs marking the last lesson complete).
  const { error } = await sb.from('course_completions').upsert({
    student_id:                   studentId,
    course_id:                    courseId,
    completed_lesson_count:       progress.completedRequired,
    total_required_lesson_count:  progress.totalRequired,
  }, { onConflict: 'student_id,course_id' })

  if (error) {
    console.error('[course-completion] insert failed:', error.message)
    return { issued: false }
  }

  await sb.from('notifications').insert({
    user_id: studentId,
    title:   '🏆 Course completed — your certificate is ready!',
    body:    `You’ve completed every required lesson in "${course.title}". Download your certificate now.`,
    type:    'success',
    link:    `/courses/${course.slug}/certificate`,
  })

  return { issued: true }
}

export function adminSBForCourses() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
