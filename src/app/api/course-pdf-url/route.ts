export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isPaidCourse, hasPurchasedCourse } from '@/lib/course-access'
import type { CourseBlock } from '@/types/course'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mints a short-lived signed URL for a `pdf` course-block, the same
// private-bucket pattern already used for programme module notes. Takes
// lessonId+blockId rather than a raw storage path — the `notes` bucket is
// shared with programme notes (`{phaseId}/{moduleId}.pdf`), so resolving
// the path server-side from the lesson's own stored content, and
// re-checking course purchase status here too, closes the gap a raw-path
// param would otherwise open: a logged-in student signing an arbitrary
// path in a bucket they don't fully own.
export async function POST(req: NextRequest) {
  try {
    const { lessonId, blockId, path: rawPath } = await req.json() as { lessonId?: string; blockId?: string; path?: string }
    if (!lessonId || !blockId) return NextResponse.json({ error: 'lessonId and blockId are required' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isStaff = ['admin', 'teacher'].includes((profileRow as { role: string } | null)?.role ?? '')

    const sb = adminSB()

    // Staff previewing the live editor can be looking at a block that
    // hasn't been saved yet (so it won't be in the lesson's persisted
    // content below) — trust a client-supplied path for staff only,
    // same trust boundary as /api/admin/notes-preview.
    if (isStaff && rawPath) {
      const { data: signed } = await sb.storage.from('notes').createSignedUrl(rawPath, 3600)
      if (!signed?.signedUrl) return NextResponse.json({ error: 'Could not generate a preview link' }, { status: 500 })
      return NextResponse.json({ url: signed.signedUrl })
    }
    const { data: lessonRow } = await sb
      .from('course_lessons')
      .select('content, module_id, course_modules!module_id(course_id)')
      .eq('id', lessonId)
      .maybeSingle()
    if (!lessonRow) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const moduleRel = (lessonRow as { course_modules: { course_id: string } | { course_id: string }[] | null }).course_modules
    const courseId = Array.isArray(moduleRel) ? moduleRel[0]?.course_id : moduleRel?.course_id
    if (!courseId) return NextResponse.json({ error: 'Lesson is not linked to a course' }, { status: 404 })

    if (!isStaff) {
      const { data: courseRow } = await sb.from('courses').select('status, price_inr').eq('id', courseId).maybeSingle()
      const course = courseRow as { status: string; price_inr: number | null } | null
      if (!course || course.status !== 'published') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (isPaidCourse(course.price_inr) && !(await hasPurchasedCourse(sb, user.id, courseId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const content = ((lessonRow as { content: CourseBlock[] | null }).content ?? []) as CourseBlock[]
    const block = content.find(b => b.id === blockId)
    if (!block || block.type !== 'pdf' || !block.path) {
      return NextResponse.json({ error: 'PDF block not found' }, { status: 404 })
    }

    const { data: signed } = await sb.storage.from('notes').createSignedUrl(block.path, 3600)
    if (!signed?.signedUrl) return NextResponse.json({ error: 'Could not generate a preview link' }, { status: 500 })

    return NextResponse.json({ url: signed.signedUrl })

  } catch (err) {
    console.error('[course-pdf-url] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
