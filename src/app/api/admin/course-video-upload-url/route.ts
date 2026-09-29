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

// Lesson videos run tens of MB — far past what a Vercel serverless/edge
// function can accept in a request body. So unlike upload-course-asset
// (which proxies small images through this server), this route only ever
// hands back a short-lived signed upload URL/token; the browser then PUTs
// the actual video bytes straight to Supabase Storage via
// supabase.storage.from('course-videos').uploadToSignedUrl(...), never
// through this server at all.
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

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const role = (profile as { role: string } | null)?.role
    if (!role || !['admin', 'teacher'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { course_id: courseId } = await req.json() as { course_id?: string }
    if (!courseId) return NextResponse.json({ error: 'Missing course_id' }, { status: 400 })

    const sb = adminSB()
    const { data: courseRow } = await sb.from('courses').select('id').eq('id', courseId).maybeSingle()
    if (!courseRow) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const path = `${courseId}/${crypto.randomUUID()}.mp4`
    const { data, error } = await sb.storage.from('course-videos').createSignedUploadUrl(path)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, path, token: data.token })

  } catch (err) {
    console.error('[course-video-upload-url] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
