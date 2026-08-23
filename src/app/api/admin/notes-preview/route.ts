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

// Lets an admin/teacher open an already-uploaded module PDF without
// needing to log in as a student — mints a short-lived signed URL for
// the private `notes` bucket and redirects straight to it, same
// signed-URL pattern the student content viewer already uses.
export async function GET(req: NextRequest) {
  try {
    const moduleId = req.nextUrl.searchParams.get('moduleId')
    if (!moduleId) return NextResponse.json({ error: 'moduleId required' }, { status: 400 })

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

    const sb = adminSB()
    const { data: moduleRow } = await sb
      .from('modules').select('notes_url').eq('id', moduleId).maybeSingle()
    const notesUrl = (moduleRow as { notes_url: string | null } | null)?.notes_url
    if (!notesUrl) return NextResponse.json({ error: 'No notes uploaded for this module' }, { status: 404 })

    const { data: signed } = await sb.storage.from('notes').createSignedUrl(notesUrl, 3600)
    if (!signed?.signedUrl) return NextResponse.json({ error: 'Could not generate preview link' }, { status: 500 })

    return NextResponse.redirect(signed.signedUrl)

  } catch (err) {
    console.error('[admin/notes-preview] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
