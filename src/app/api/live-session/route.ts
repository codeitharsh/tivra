export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { checkLiveSessionAccess } from '@/lib/live-session-access'
import { getRecipientsForSession } from '@/lib/notify-recipients'
import { sendEmailFireAndForget } from '@/lib/email'
import { renderLiveClassScheduledEmail } from '@/lib/email-templates/live-class-scheduled'

// ── Live classes via teacher-provided meeting links ────────────
// Previously this route created hosted video rooms itself (first
// meet.jit.si, then Daily.co). Both required either a third-party
// account (and a card Tivra doesn't have) or came with real downsides
// (Jitsi's free tier started showing ads mid-class). Simplest reliable
// path with zero cost and zero signup: the teacher creates the meeting
// in their own Microsoft Teams (free, no card needed for a personal
// account) and pastes the join link in when scheduling. Tivra still
// does everything it did before around that link — batch/programme
// authorization before ever handing it out — it just no longer hosts
// the video call itself; students are redirected to Teams to join.
//
// Trade-off worth knowing: a Teams link isn't a per-user token like
// Daily's was, so once a student has it, forwarding it outside Tivra
// bypasses Tivra's own checks the same way a plain Jitsi link did.
// Teams' own lobby/waiting-room and "people in my org only" settings
// (configured by the teacher directly in Teams) are the mitigation for
// that now, not anything this route enforces.

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role, full_name, batch_id').eq('id', user.id).single()
  const p = profile as { role: string; full_name: string; batch_id: string | null } | null
  return p ? { ...user, role: p.role, full_name: p.full_name, batch_id: p.batch_id } : null
}

async function requireStaff() {
  const user = await getAuthUser()
  if (!user || !['admin', 'teacher'].includes(user.role)) return null
  return user
}

function isPlausibleMeetingLink(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const action    = body.action    as string
    const sessionId = body.sessionId as string | undefined

    const sb = adminSB()

    // ── SCHEDULE SESSION ──────────────────────────────────────
    if (action === 'schedule_session') {
      const user = await requireStaff()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const {
        title, description, phaseId, moduleId, batchId,
        scheduledAt, durationMinutes, meetingLink,
      } = body as {
        title: string; description?: string
        phaseId?: string; moduleId?: string; batchId?: string
        scheduledAt: string; durationMinutes: number; meetingLink: string
      }

      if (!title || !scheduledAt) {
        return NextResponse.json({ error: 'Title and scheduledAt required' }, { status: 400 })
      }
      if (!meetingLink || !isPlausibleMeetingLink(meetingLink)) {
        return NextResponse.json({ error: 'A valid Teams meeting link is required' }, { status: 400 })
      }

      const { data, error } = await sb
        .from('live_sessions')
        .insert({
          title,
          description:      description   || null,
          phase_id:         phaseId       || null,
          module_id:        moduleId      || null,
          batch_id:         batchId       || null,
          scheduled_at:     scheduledAt,
          duration_minutes: durationMinutes ?? 60,
          platform:         'teams',
          join_url:         meetingLink.trim(),
          host_id:          user.id,
          created_by:       user.id,
          is_live:          false,
          is_completed:     false,
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // ── Notify the relevant students ──────────────────────────
      // Best-effort: never let a notification failure turn a
      // successful schedule into an error response for the teacher.
      try {
        const recipients = await getRecipientsForSession(sb, {
          batchId: batchId || null, phaseId: phaseId || null, programId: null,
        })
        await Promise.all(recipients.map(r => {
          const { subject, html, text } = renderLiveClassScheduledEmail({
            fullName: r.full_name ?? undefined,
            title, scheduledAt, durationMinutes: durationMinutes ?? 60,
          })
          return sendEmailFireAndForget({
            to: r.email, subject, html, text,
            emailType: 'live_class_scheduled', userId: r.id,
            metadata: { sessionId: (data as { id: string }).id, batchId, phaseId },
          })
        }))
      } catch (notifyErr) {
        console.error('[live-session] Notification step failed (schedule itself still succeeded):', notifyErr)
      }

      return NextResponse.json({ success: true, sessionId: (data as { id: string }).id })
    }

    // All remaining actions require sessionId
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    // ── GO LIVE ────────────────────────────────────────────────
    // No room to create — the teacher already provided the meeting
    // link when scheduling. Going live just marks the session live
    // (so it shows up as joinable) and hands back that same link so
    // the teacher's own "Go Live" click can open it too.
    if (action === 'go_live') {
      const user = await requireStaff()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { data: sessionData, error: fetchError } = await sb
        .from('live_sessions')
        .select('join_url')
        .eq('id', sessionId)
        .single()

      if (fetchError || !sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      const joinUrl = (sessionData as { join_url: string | null }).join_url
      if (!joinUrl) return NextResponse.json({ error: 'No meeting link set for this session' }, { status: 400 })

      const { error } = await sb.from('live_sessions').update({
        is_live:      true,
        is_completed: false,
      }).eq('id', sessionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ success: true, joinUrl })
    }

    // ── END SESSION ────────────────────────────────────────────
    if (action === 'end_session') {
      const user = await requireStaff()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { error } = await sb.from('live_sessions').update({
        is_live:      false,
        is_completed: true,
      }).eq('id', sessionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ success: true, recordingUrl: null })
    }

    // ── GET JOIN LINK ────────────────────────────────────────────
    // Same authorization gate as before (batch/programme enrollment) —
    // only what's handed out at the end of it changed, from a minted
    // per-user token to the teacher's own stored Teams link.
    if (action === 'get_student_token') {
      const user = await getAuthUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (user.role === 'student') {
        const { data: profile } = await sb
          .from('profiles').select('access_status').eq('id', user.id).single()
        if ((profile as { access_status: string } | null)?.access_status !== 'active') {
          return NextResponse.json({ error: 'Account not active' }, { status: 403 })
        }
      }

      const { data: sessionData } = await sb
        .from('live_sessions')
        .select('join_url, is_live, is_completed, batch_id, phase_id, program_id')
        .eq('id', sessionId)
        .single()

      if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      const s = sessionData as {
        join_url: string | null
        is_live: boolean; is_completed: boolean
        batch_id: string | null; phase_id: string | null; program_id: string | null
      }

      if (user.role === 'student') {
        const access = await checkLiveSessionAccess(sb, user.id, user.batch_id, s)
        if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 403 })
      }

      if (s.is_completed) return NextResponse.json({ error: 'Session has ended' }, { status: 410 })
      if (!s.join_url) return NextResponse.json({ error: 'No meeting link set for this session' }, { status: 404 })

      return NextResponse.json({ success: true, roomUrl: s.join_url })
    }

    // ── FETCH RECORDING ────────────────────────────────────────
    // No automatic recording — teachers use Teams' own recording (if
    // enabled on their account) and paste the resulting link manually.
    if (action === 'fetch_recording') {
      return NextResponse.json({
        recordings: [],
        info: 'No automatic recording. Use the manual recording URL option.',
      })
    }

    // ── SAVE RECORDING URL (manual) ────────────────────────────
    if (action === 'save_recording') {
      const user = await requireStaff()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const recordingUrl = body.recordingUrl as string
      if (!recordingUrl) return NextResponse.json({ error: 'recordingUrl required' }, { status: 400 })

      const { error } = await sb
        .from('live_sessions')
        .update({ recording_url: recordingUrl.trim() })
        .eq('id', sessionId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[live-session] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
