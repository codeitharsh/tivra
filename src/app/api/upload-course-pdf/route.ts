export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Uploads a PDF for a self-paced course's `pdf` lesson block, into the
// same private `notes` bucket programme module notes already use — just
// under a course-scoped path (course-pdfs/{courseId}/{lessonId}/{blockId}.pdf)
// instead of {phaseId}/{moduleId}.pdf, so the two never collide.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = (profile as { role: string } | null)?.role
    if (!role || !['admin', 'teacher'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const form     = await req.formData()
    const file     = form.get('file')      as File | null
    const courseId = form.get('course_id') as string | null
    const lessonId = form.get('lesson_id') as string | null
    const blockId  = form.get('block_id')  as string | null

    if (!file || !courseId || !lessonId || !blockId)
      return NextResponse.json({ error: 'Missing file, course_id, lesson_id, or block_id' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf'))
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })

    const sb = adminSB()

    // Verify the lesson actually belongs to this course before writing —
    // same client-supplied-ids-must-correlate check as /api/upload-notes.
    const { data: lessonRow } = await sb
      .from('course_lessons')
      .select('module_id, course_modules!module_id(course_id)')
      .eq('id', lessonId)
      .maybeSingle()
    const moduleRel = (lessonRow as { course_modules: { course_id: string } | { course_id: string }[] | null } | null)?.course_modules
    const actualCourseId = Array.isArray(moduleRel) ? moduleRel[0]?.course_id : moduleRel?.course_id
    if (!lessonRow || actualCourseId !== courseId) {
      return NextResponse.json({ error: 'lesson_id does not belong to the given course_id' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const headerStr = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 5)))
    if (headerStr !== '%PDF-') {
      return NextResponse.json({ error: 'File content does not match a valid PDF.' }, { status: 400 })
    }

    const path = `course-pdfs/${courseId}/${lessonId}/${blockId}.pdf`
    const { error: uploadError } = await sb.storage
      .from('notes').upload(path, arrayBuffer, { upsert: true, contentType: 'application/pdf' })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    return NextResponse.json({ success: true, path })

  } catch (err) {
    console.error('[upload-course-pdf] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
