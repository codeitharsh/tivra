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

const PREVIEW_SIGNED_URL_TTL_SECONDS = 300 // 5 minutes — fetched fresh on click, not stored

export async function GET(req: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  try {
    const { programId } = await params

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

    const sb = adminSB()
    const { data: programRow } = await sb
      .from('programs')
      .select('curriculum_url')
      .eq('id', programId)
      .maybeSingle()

    const path = (programRow as { curriculum_url: string | null } | null)?.curriculum_url
    if (!path) {
      return NextResponse.json({ error: 'No curriculum uploaded for this programme' }, { status: 404 })
    }

    const { data: signed, error } = await sb.storage
      .from('curricula')
      .createSignedUrl(path, PREVIEW_SIGNED_URL_TTL_SECONDS)

    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? 'Could not create preview link' }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl })

  } catch (err) {
    console.error('[curriculum-preview] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
