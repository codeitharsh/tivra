export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { checkLiveSessionAccess } from '@/lib/live-session-access'

// ── Jitsi config ──────────────────────────────────────────────
// Uses meet.jit.si — free, no API key, no subscription needed
const JITSI_HOST = 'meet.jit.si'

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

// ── Generate a unique Jitsi room name ─────────────────────────
// Previously derived from the session's own (publicly-visible-in-URL)
// UUID, which meant the room name was never actually secret — anyone
// who could see a session's id (e.g. from its /live/[sessionId] URL)
// could compute the exact meet.jit.si room without ever going through
// an authorized endpoint. Generated randomly instead, once per session,
// the first time a room is created — unrelated to the session id, so
// it can only be learned via the authorized create_room/get_student_token
// flow.
function getRoomName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `tivra-${hex}`
}

// Password derived via HMAC keyed by a server-only secret, not just a
// slice of the publicly-visible session ID. The room name (and therefore
// the session ID) appears in URLs shared with students, so a password
// derived purely from slicing that same ID adds no real protection —
// anyone who learns the slicing pattern could recompute it. Keying with
// SUPABASE_SERVICE_ROLE_KEY (already present, server-only, never sent to
// the client) means the password can't be recomputed without server
// access, while staying deterministic for the same session.
//
// Previously this fell back to a hardcoded string
// ('tivra-fallback-secret') if the env var was ever missing — which
// would have meant that in exactly the failure case this mechanism is
// supposed to guard against (misconfigured deployment, missing env
// var), the password became a PUBLIC, SOURCE-CODE-VISIBLE constant,
// completely defeating the protection. Now throws instead, so a
// misconfigured deployment fails loudly (every live-class action
// returns a 500) rather than silently shipping a guessable password.
//
// `nonce` is a random value regenerated each time a NEW room is created
// for a session (see create_room below) — folding it in means a
// password leaked during one go-live cycle stops working once that
// session ends and a fresh room/nonce is created for the next one,
// instead of being valid forever for that session's lifetime.
async function getRoomPassword(sessionId: string, nonce: string | null): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured — cannot derive a secure room password.')
  }
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${sessionId}:${nonce ?? ''}`))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex.slice(0, 16)
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getJitsiUrls(roomName: string, password: string) {
  const base = `https://${JITSI_HOST}/${roomName}`
  return { roomUrl: base, roomName, password }
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
        scheduledAt, durationMinutes,
      } = body as {
        title: string; description?: string
        phaseId?: string; moduleId?: string; batchId?: string
        scheduledAt: string; durationMinutes: number
      }

      if (!title || !scheduledAt) {
        return NextResponse.json({ error: 'Title and scheduledAt required' }, { status: 400 })
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
          platform:         'jitsi',
          host_id:          user.id,
          created_by:       user.id,
          is_live:          false,
          is_completed:     false,
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, sessionId: (data as { id: string }).id })
    }

    // All remaining actions require sessionId
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    // ── CREATE / GET ROOM + GO LIVE ───────────────────────────
    // With Jitsi there's no API call — we just generate the room name
    // and save it. The teacher opens the room URL directly.
    if (action === 'create_room') {
      const user = await requireStaff()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      // Check if room already assigned
      const { data: sessionData } = await sb
        .from('live_sessions')
        .select('title, duration_minutes, daily_room_name, join_url, room_nonce')
        .eq('id', sessionId)
        .single()

      if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      const s = sessionData as {
        title: string; duration_minutes: number
        daily_room_name: string | null; join_url: string | null
        room_nonce: string | null
      }

      // Use existing room name/nonce or generate fresh ones. A new nonce
      // here — only when there's no room yet, i.e. once per go-live cycle
      // — is what makes the derived password stop working once this
      // session ends and a later one gets a new room (see end_session).
      const roomName = s.daily_room_name ?? getRoomName()
      const nonce    = s.daily_room_name ? s.room_nonce : generateNonce()
      const password   = await getRoomPassword(sessionId, nonce)
      const { roomUrl } = getJitsiUrls(roomName, password)

      // Teacher URL — moderator with password set automatically
      const teacherUrl = `${roomUrl}#userInfo.displayName="${encodeURIComponent(user.full_name ?? 'Teacher')}"&config.startWithVideoMuted=false&config.startWithAudioMuted=false&config.prejoinPageEnabled=false&config.roomPasswordNumberOfDigits=false&password=${password}`

      // Save room info if not already saved
      if (!s.daily_room_name) {
        await sb.from('live_sessions').update({
          daily_room_name: roomName,
          daily_room_url:  roomUrl,
          join_url:        roomUrl,
          room_nonce:      nonce,
          platform:        'jitsi',
        }).eq('id', sessionId)
      }

      return NextResponse.json({ success: true, teacherUrl, roomName, roomUrl })
    }

    // ── GO LIVE ────────────────────────────────────────────────
    if (action === 'go_live') {
      const user = await requireStaff()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      await sb.from('live_sessions').update({
        is_live:      true,
        is_completed: false,
      }).eq('id', sessionId)

      return NextResponse.json({ success: true })
    }

    // ── END SESSION ────────────────────────────────────────────
    if (action === 'end_session') {
      const user = await requireStaff()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      // Clear the room mapping once a session truly ends — a completed
      // session's teacher/student UI never offers a "rejoin" path back
      // into it, so there's no reason for its room name/URL to keep
      // resolving forever. This shrinks how long a leaked link stays
      // useful: once the class ends, that link stops working, even if
      // it was shared outside Tivra while the class was live.
      await sb.from('live_sessions').update({
        is_live:         false,
        is_completed:    true,
        daily_room_name: null,
        daily_room_url:  null,
        join_url:        null,
        room_nonce:      null,
      }).eq('id', sessionId)

      return NextResponse.json({ success: true, recordingUrl: null })
    }

    // ── GET STUDENT URL ────────────────────────────────────────
    if (action === 'get_student_token') {
      const user = await getAuthUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      // Verify active student
      if (user.role === 'student') {
        const { data: profile } = await sb
          .from('profiles').select('access_status').eq('id', user.id).single()
        if ((profile as { access_status: string } | null)?.access_status !== 'active') {
          return NextResponse.json({ error: 'Account not active' }, { status: 403 })
        }
      }

      const { data: sessionData } = await sb
        .from('live_sessions')
        .select('daily_room_name, is_live, is_completed, batch_id, phase_id, program_id, room_nonce')
        .eq('id', sessionId)
        .single()

      if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      const s = sessionData as {
        daily_room_name: string | null
        is_live: boolean; is_completed: boolean
        batch_id: string | null; phase_id: string | null; program_id: string | null
        room_nonce: string | null
      }

      // Sessions scoped to a batch and/or programme are only joinable by
      // students who belong to that batch / are enrolled in that
      // programme — previously any active student could fetch a valid
      // room URL for ANY session just by knowing its id. Sessions with
      // no batch/programme signal stay open to any active student,
      // matching the scheduler UI's "All batches" / "No phase" options.
      if (user.role === 'student') {
        const access = await checkLiveSessionAccess(sb, user.id, user.batch_id, s)
        if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 403 })
      }

      if (s.is_completed) return NextResponse.json({ error: 'Session has ended' }, { status: 410 })
      if (!s.daily_room_name) return NextResponse.json({ error: 'Room not ready yet' }, { status: 404 })

      const password   = await getRoomPassword(sessionId, s.room_nonce)
      const { roomUrl } = getJitsiUrls(s.daily_room_name, password)

      // Student URL — muted, no video, password passed silently
      const studentUrl = `${roomUrl}#userInfo.displayName="${encodeURIComponent(user.full_name ?? 'Student')}"&config.startWithVideoMuted=true&config.startWithAudioMuted=true&config.prejoinPageEnabled=false&password=${password}`

      return NextResponse.json({ success: true, roomUrl: studentUrl, roomName: s.daily_room_name })
    }

    // ── FETCH RECORDING ────────────────────────────────────────
    // Jitsi doesn't have cloud recording on free tier
    // Teacher can paste a manual recording URL
    if (action === 'fetch_recording') {
      return NextResponse.json({
        recordings: [],
        info: 'Jitsi free tier does not have cloud recording. Use the manual recording URL option.',
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
    console.error('[daily] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
