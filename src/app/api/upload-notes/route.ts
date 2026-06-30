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

    const form     = await req.formData()
    const file     = form.get('file')      as File | null
    const moduleId = form.get('module_id') as string | null
    const phaseId  = form.get('phase_id')  as string | null

    if (!file || !moduleId || !phaseId)
      return NextResponse.json({ error: 'Missing file, module_id, or phase_id' }, { status: 400 })
    if (!file.name.endsWith('.pdf'))
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })

    const sb = adminSB()

    // ── Verify moduleId actually belongs to phaseId ───────────────
    // Previously the storage path was built directly from these two
    // client-supplied form fields with no check that they actually
    // correspond to each other. A staff member (or a compromised
    // staff session) could write a PDF to an arbitrary phaseId/
    // moduleId.pdf path — including overwriting a DIFFERENT module's
    // notes by supplying a mismatched moduleId, since the path itself
    // doesn't have to match any real module/phase relationship for
    // the upload to succeed.
    const { data: moduleRow, error: modErr } = await sb
      .from('modules')
      .select('phase_id')
      .eq('id', moduleId)
      .maybeSingle()

    if (modErr || !moduleRow) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }
    if ((moduleRow as { phase_id: string }).phase_id !== phaseId) {
      return NextResponse.json({ error: 'module_id does not belong to the given phase_id' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()

    // ── Verify actual file content, not just the filename. A renamed
    //    non-PDF file would otherwise pass the .endsWith('.pdf') check above.
    //    Real PDFs always begin with the magic bytes "%PDF-". ──────────────
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const headerStr    = new TextDecoder().decode(headerBytes)
    if (headerStr !== '%PDF-') {
      return NextResponse.json({ error: 'File content does not match a valid PDF.' }, { status: 400 })
    }

    const path = `${phaseId}/${moduleId}.pdf`

    const { error: uploadError } = await sb.storage
      .from('notes').upload(path, arrayBuffer, { upsert: true, contentType: 'application/pdf' })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { error: dbError } = await sb
      .from('modules').update({ notes_url: path }).eq('id', moduleId)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ success: true, path })

  } catch (err) {
    console.error('[upload-notes] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
