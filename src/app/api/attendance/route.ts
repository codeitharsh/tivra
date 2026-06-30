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

    const sb = adminSB()
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
      // ── Entitlement check ──────────────────────────────────────
      // Previously a student could mark themselves "present" at a
      // live session belonging to a programme they were never
      // enrolled in, simply by knowing or guessing the sessionId —
      // there was no check against enrolled_programs at all. Sessions
      // not tied to any specific programme (program_id null — e.g. a
      // general orientation call) are left open to any authenticated
      // student, matching the existing nullable schema design.
      const { data: sessionRow } = await sb
        .from('live_sessions')
        .select('program_id')
        .eq('id', sessionId)
        .maybeSingle()

      const sessionProgramId = (sessionRow as { program_id: string | null } | null)?.program_id
      if (sessionProgramId) {
        const { data: enrolled } = await sb
          .from('enrolled_programs')
          .select('id')
          .eq('student_id', studentId)
          .eq('program_id', sessionProgramId)
          .maybeSingle()

        if (!enrolled) {
          return NextResponse.json({ error: 'You are not enrolled in the programme this session belongs to.' }, { status: 403 })
        }
      }

      const { data: ctrl } = await sb
        .from('session_controls')
        .select('session_code, attendance_window_open')
        .eq('id', sessionId)
        .maybeSingle()

      const c = ctrl as { session_code: string; attendance_window_open: boolean } | null
      if (c?.attendance_window_open && sessionCode && c.session_code !== sessionCode)
        return NextResponse.json({ error: 'Invalid session code' }, { status: 403 })

      const { error } = await sb
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
      const { data: existing } = await sb
        .from('attendance_records')
        .select('joined_at')
        .eq('session_id', sessionId)
        .eq('student_id', studentId)
        .maybeSingle()

      const { data: session } = await sb
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

      const { error } = await sb.from('attendance_records')
        .update({ left_at: new Date().toISOString(), status } as Record<string, unknown>)
        .eq('session_id', sessionId)
        .eq('student_id', studentId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, action: 'left', status })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[attendance] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
