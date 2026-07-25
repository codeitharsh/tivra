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
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => null) as { program_id?: string } | null
    const programId = body?.program_id

    if (!programId) {
      return NextResponse.json({ error: 'Missing program_id' }, { status: 400 })
    }

    const sb = adminSB()

    // Look up the actual stored path server-side — never trust a
    // client-supplied path, same reasoning as delete-notes/route.ts.
    const { data: programRow, error: fetchErr } = await sb
      .from('programs')
      .select('curriculum_url')
      .eq('id', programId)
      .single()

    if (fetchErr || !programRow) {
      return NextResponse.json({ error: 'Programme not found' }, { status: 404 })
    }

    const path = (programRow as { curriculum_url: string | null }).curriculum_url
    if (!path) {
      return NextResponse.json({ error: 'No curriculum uploaded for this programme' }, { status: 400 })
    }

    // Remove the file first — if this fails, don't clear the DB
    // pointer, so a failed delete doesn't silently orphan the file
    // while making it look like there's nothing to clean up.
    const { error: storageErr } = await sb.storage.from('curricula').remove([path])
    if (storageErr) {
      return NextResponse.json({ error: `Could not delete file: ${storageErr.message}` }, { status: 500 })
    }

    const { error: dbErr } = await sb
      .from('programs')
      .update({ curriculum_url: null })
      .eq('id', programId)

    if (dbErr) {
      return NextResponse.json({
        error: `File deleted but database update failed: ${dbErr.message}.`,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('[delete-curriculum] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
