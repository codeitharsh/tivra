export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSB } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getCourseProgress } from '@/lib/course-progress'
import { checkAndIssueCourseCompletion } from '@/lib/course-completion'

// Deliberately untyped (not the shared createAdminClient<Database>) —
// course_* tables aren't declared in src/types/database.ts (same gap as
// subjects/free_notes), and the typed client makes .upsert() hard-error
// against `never` for any table it doesn't know about.
function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const admin = adminSB()

    // ── SET LAST LESSON (resume-where-left-off bookkeeping) — this is
    //    also what implicitly creates the enrollment record. Visiting a
    //    lesson requires login (middleware.ts STEP 2 gates everything
    //    past /courses/{slug}), so by the time this fires the visitor
    //    has already gone through login/register — there is no separate
    //    "enroll" step to call first. student_id is re-derived from the
    //    session, never the request body. ──
    if (body.action === 'set_last_lesson') {
      const { courseId, lessonId } = body as { courseId?: string; lessonId?: string }
      if (!courseId || !lessonId) return NextResponse.json({ error: 'courseId and lessonId required' }, { status: 400 })

      const { error } = await admin.from('course_enrollments').upsert({
        student_id: user.id, course_id: courseId, last_lesson_id: lessonId,
      }, { onConflict: 'student_id,course_id' })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── MARK LESSON COMPLETE — the one write that must never trust the
    //    client: re-derives student_id from the session (never the
    //    request body), validates the lesson actually belongs to a
    //    published course before recording anything, then recomputes
    //    percent/eligibility from real rows before possibly issuing a
    //    certificate. This is why it runs on the service-role client —
    //    course_lesson_progress has no client insert policy at all. ──
    if (body.action === 'mark_lesson_complete') {
      const { lessonId } = body as { lessonId?: string }
      if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

      const { data: lessonRow } = await admin
        .from('course_lessons')
        .select('id, module_id, course_modules!module_id(course_id, courses!course_id(id, status))')
        .eq('id', lessonId)
        .maybeSingle()

      if (!lessonRow) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

      // Supabase's to-one join can come back as an object or a
      // single-element array depending on relationship inference —
      // handled defensively since this directly gates a write.
      type ModuleJoin = { course_id: string; courses: { id: string; status: string } | { id: string; status: string }[] | null }
      const moduleJoinRaw = (lessonRow as { course_modules: ModuleJoin | ModuleJoin[] }).course_modules
      const moduleJoin = Array.isArray(moduleJoinRaw) ? moduleJoinRaw[0] : moduleJoinRaw
      const courseJoinRaw = moduleJoin?.courses
      const courseJoin = Array.isArray(courseJoinRaw) ? courseJoinRaw[0] : courseJoinRaw

      if (!courseJoin || courseJoin.status !== 'published') {
        return NextResponse.json({ error: 'This lesson is not currently available' }, { status: 404 })
      }
      const courseId = courseJoin.id

      const { error: insertError } = await admin.from('course_lesson_progress').upsert({
        student_id: user.id, lesson_id: lessonId,
      }, { onConflict: 'student_id,lesson_id', ignoreDuplicates: true })

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

      // Keep resume-tracking in sync even if the caller never separately
      // calls set_last_lesson.
      await admin.from('course_enrollments').upsert({
        student_id: user.id, course_id: courseId, last_lesson_id: lessonId,
      }, { onConflict: 'student_id,course_id' })

      const progress   = await getCourseProgress(admin, user.id, courseId)
      const completion = await checkAndIssueCourseCompletion(admin, user.id, courseId)

      return NextResponse.json({ success: true, progress, certificateIssued: completion.issued })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[course-progress] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
