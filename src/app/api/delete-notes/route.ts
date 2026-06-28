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
    if (!role || !['admin', 'teacher'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // req.json() throws on an empty or malformed body — guarded by the
    // outer try/catch so the client always gets JSON back, never an
    // empty response that fails res.json() on their end.
    const body = await req.json().catch(() => null) as { module_id?: string } | null
    const moduleId = body?.module_id

    if (!moduleId) {
      return NextResponse.json({ error: 'Missing module_id' }, { status: 400 })
    }

    const sb = adminSB()

    // Look up the actual stored path — never trust a client-supplied path,
    // always derive it from the DB row so a teacher can't pass an arbitrary
    // path and delete something outside their own module's notes.
    const { data: moduleRow, error: fetchErr } = await sb
      .from('modules')
      .select('notes_url')
      .eq('id', moduleId)
      .single()

    if (fetchErr || !moduleRow) {
      console.error('[delete-notes] Module lookup failed.', {
        moduleId,
        fetchErrMessage: fetchErr?.message,
        fetchErrCode:    fetchErr?.code,
        fetchErrDetails: fetchErr?.details,
        moduleRowIsNull: !moduleRow,
      })
      return NextResponse.json({
        error: `Module not found (id: ${moduleId}${fetchErr ? `, db error: ${fetchErr.message}` : ', no matching row'})`,
      }, { status: 404 })
    }

    const notesPath = (moduleRow as { notes_url: string | null }).notes_url

    if (!notesPath) {
      return NextResponse.json({ error: 'No notes uploaded for this module' }, { status: 400 })
    }

    // Remove the file from storage first. If this fails, don't clear the
    // DB pointer — better to have a dangling-but-findable file than a
    // cleared notes_url pointing at nothing (which would look like "no
    // notes" while actually orphaning a file in storage forever).
    const { error: storageErr } = await sb.storage.from('notes').remove([notesPath])
    if (storageErr) {
      return NextResponse.json({ error: `Could not delete file: ${storageErr.message}` }, { status: 500 })
    }

    const { error: dbErr } = await sb
      .from('modules')
      .update({ notes_url: null })
      .eq('id', moduleId)

    if (dbErr) {
      // The file is already gone from storage at this point — surface
      // this clearly since it leaves the module pointing at a dead path
      // until manually corrected.
      return NextResponse.json({
        error: `File deleted but database update failed: ${dbErr.message}. The module may still show "uploaded" until this is fixed.`,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    // Catch-all so this route NEVER returns an empty/non-JSON body —
    // whatever broke, the client still gets a parseable error response.
    console.error('[delete-notes] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
