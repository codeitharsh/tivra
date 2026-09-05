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

// Near-verbatim of /api/upload-notes/route.ts's validation logic,
// targeting the free-notes bucket/table instead of notes/modules —
// same magic-byte check, same role check, same path-ownership
// cross-check pattern.
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

    const form      = await req.formData()
    const file      = form.get('file')       as File | null
    const noteId    = form.get('note_id')    as string | null
    const subjectId = form.get('subject_id') as string | null

    if (!file || !noteId || !subjectId)
      return NextResponse.json({ error: 'Missing file, note_id, or subject_id' }, { status: 400 })
    if (!file.name.endsWith('.pdf'))
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })

    const sb = adminSB()

    // Verify noteId actually belongs to subjectId, same reasoning as
    // upload-notes/route.ts: without this, a staff member could write
    // a PDF to an arbitrary subjectId/noteId.pdf path. free_notes has
    // no direct subject_id column — resolve it via unit_id -> units.
    const { data: noteRow, error: noteErr } = await sb
      .from('free_notes')
      .select('unit_id, units!unit_id(subject_id)')
      .eq('id', noteId)
      .maybeSingle()

    if (noteErr || !noteRow) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    type UnitJoin = { subject_id: string } | { subject_id: string }[] | null
    const unitJoinRaw = (noteRow as { units: UnitJoin }).units
    const unitJoin = Array.isArray(unitJoinRaw) ? unitJoinRaw[0] : unitJoinRaw
    if (!unitJoin || unitJoin.subject_id !== subjectId) {
      return NextResponse.json({ error: 'note_id does not belong to the given subject_id' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()

    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const headerStr    = new TextDecoder().decode(headerBytes)
    if (headerStr !== '%PDF-') {
      return NextResponse.json({ error: 'File content does not match a valid PDF.' }, { status: 400 })
    }

    const path = `${subjectId}/${noteId}.pdf`

    const { error: uploadError } = await sb.storage
      .from('free-notes').upload(path, arrayBuffer, { upsert: true, contentType: 'application/pdf' })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { error: dbError } = await sb
      .from('free_notes').update({ notes_url: path }).eq('id', noteId)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ success: true, path })

  } catch (err) {
    console.error('[upload-free-note] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
