export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const admin = createSB(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // ── Verify caller is authenticated ──────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: string
    sessionId: string
    studentId: string
    sessionCode?: string
  }

  const { action, sessionId, sessionCode } = body

  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

  // ── CRITICAL: studentId MUST be the authenticated user's ID ──
  // Ignore any studentId from the request body — use the verified session
  const studentId = user.id

  if (action === 'join') {
    const { data: ctrl } = await admin
      .from('session_controls')
      .select('session_code, attendance_window_open')
      .eq('id', sessionId)
      .maybeSingle()

    const c = ctrl as { session_code: string; attendance_window_open: boolean } | null
    if (c?.attendance_window_open && sessionCode && c.session_code !== sessionCode)
      return NextResponse.json({ error: 'Invalid session code' }, { status: 403 })

    const { error } = await admin
      .from('attendance_records')
      .upsert({
        session_id:   sessionId,
        student_id:   studentId,
        joined_at:    new Date().toISOString(),
        status:       'present',
        session_code: sessionCode ?? null,
      } as Record<string, unknown>, { onConflict: 'session_id,student_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'joined' })
  }

  if (action === 'leave') {
    const { data: existing } = await admin
      .from('attendance_records')
      .select('joined_at')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle()

    const { data: session } = await admin
      .from('live_sessions')
      .select('duration_minutes')
      .eq('id', sessionId)
      .maybeSingle()

    const ex  = existing as { joined_at: string } | null
    const dur = (session as { duration_minutes: number } | null)?.duration_minutes ?? 60
    let status: 'present' | 'partial' = 'present'

    if (ex?.joined_at) {
      const mins = (Date.now() - new Date(ex.joined_at).getTime()) / 60000
      if (mins < dur * 0.5) status = 'partial'
    }

    const { error } = await admin.from('attendance_records')
      .update({ left_at: new Date().toISOString(), status } as Record<string, unknown>)
      .eq('session_id', sessionId)
      .eq('student_id', studentId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'left', status })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
