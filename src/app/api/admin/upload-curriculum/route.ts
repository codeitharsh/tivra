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

    const form      = await req.formData()
    const file      = form.get('file')       as File | null
    const programId = form.get('program_id') as string | null

    if (!file || !programId)
      return NextResponse.json({ error: 'Missing file or program_id' }, { status: 400 })
    if (!file.name.endsWith('.pdf'))
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })

    const sb = adminSB()

    const { data: programRow, error: progErr } = await sb
      .from('programs')
      .select('id')
      .eq('id', programId)
      .maybeSingle()

    if (progErr || !programRow) {
      return NextResponse.json({ error: 'Programme not found' }, { status: 404 })
    }

    const arrayBuffer = await file.arrayBuffer()

    // Verify actual file content, not just the filename — a renamed
    // non-PDF file would otherwise pass the .endsWith('.pdf') check above.
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const headerStr    = new TextDecoder().decode(headerBytes)
    if (headerStr !== '%PDF-') {
      return NextResponse.json({ error: 'File content does not match a valid PDF.' }, { status: 400 })
    }

    const path = `${programId}.pdf`

    const { error: uploadError } = await sb.storage
      .from('curricula').upload(path, arrayBuffer, { upsert: true, contentType: 'application/pdf' })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { error: dbError } = await sb
      .from('programs').update({ curriculum_url: path }).eq('id', programId)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ success: true, path })

  } catch (err) {
    console.error('[upload-curriculum] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
