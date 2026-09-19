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

// Magic-byte signatures for the image types we accept — same validation
// posture as upload-free-note/route.ts (never trust the filename/
// declared content-type alone).
function detectImageType(bytes: Uint8Array): { ext: string; contentType: string } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: 'png', contentType: 'image/png' }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { ext: 'webp', contentType: 'image/webp' }
  }
  return null
}

// Admin/teacher-facing cover-image upload for self-paced courses —
// previously this could only be done via one-off scripts using the
// service-role key directly. Mirrors upload-free-note/route.ts's shape.
// Always writes to a brand-new, unique filename (never overwrites an
// existing path) — see the cover-image caching bug this convention was
// established to avoid: a browser/CDN can cache a fixed URL indefinitely,
// so a replaced cover only reliably shows up under a new URL.
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

    const form = await req.formData()
    const file = form.get('file') as File | null
    const courseId = form.get('course_id') as string | null

    if (!file || !courseId) {
      return NextResponse.json({ error: 'Missing file or course_id' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })
    }

    const sb = adminSB()

    const { data: courseRow } = await sb.from('courses').select('id').eq('id', courseId).maybeSingle()
    if (!courseRow) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const arrayBuffer = await file.arrayBuffer()
    const detected = detectImageType(new Uint8Array(arrayBuffer.slice(0, 16)))
    if (!detected) {
      return NextResponse.json({ error: 'File must be a PNG, JPEG, or WebP image' }, { status: 400 })
    }

    const path = `${courseId}/cover-${crypto.randomUUID()}.${detected.ext}`

    const { error: uploadError } = await sb.storage
      .from('course-assets').upload(path, arrayBuffer, { contentType: detected.contentType })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { error: dbError } = await sb
      .from('courses').update({ cover_image_path: path }).eq('id', courseId)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ success: true, path })

  } catch (err) {
    console.error('[upload-course-cover] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
