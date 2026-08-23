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

// Magic-byte check, same reasoning as upload-notes/upload-free-note —
// never trust a client-supplied filename/extension alone. SVG is
// deliberately not accepted: it's the one "image" format that can carry
// executable script, and this bucket is public.
function detectImageType(bytes: Uint8Array): { ext: string; contentType: string } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', contentType: 'image/png' }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { ext: 'gif', contentType: 'image/gif' }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return { ext: 'webp', contentType: 'image/webp' }
  return null
}

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

    const form     = await req.formData()
    const file     = form.get('file')     as File | null
    const courseId = form.get('course_id') as string | null

    if (!file || !courseId) return NextResponse.json({ error: 'Missing file or course_id' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })

    const sb = adminSB()
    const { data: courseRow } = await sb.from('courses').select('id').eq('id', courseId).maybeSingle()
    if (!courseRow) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const arrayBuffer = await file.arrayBuffer()
    const detected = detectImageType(new Uint8Array(arrayBuffer.slice(0, 12)))
    if (!detected) return NextResponse.json({ error: 'Only PNG, JPEG, GIF, or WebP images are allowed' }, { status: 400 })

    const path = `${courseId}/${crypto.randomUUID()}.${detected.ext}`
    const { error: uploadError } = await sb.storage
      .from('course-assets').upload(path, arrayBuffer, { contentType: detected.contentType })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    return NextResponse.json({ success: true, path })

  } catch (err) {
    console.error('[upload-course-asset] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
