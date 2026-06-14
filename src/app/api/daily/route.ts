export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  const p = profile as { role: string; full_name: string } | null
  return p ? { ...user, role: p.role, full_name: p.full_name } : null
}

async function requireStaff() {
  const user = await getAuthUser()
  if (!user || !['admin', 'teacher'].includes(user.role)) return null
  return user
}

// ── Generate a unique Jitsi room name ─────────────────────────
// Uses sessionId so it's deterministic — same session always gets same room
function getRoomName(sessionId: string): string {
  const short = sessionId.replace(/-/g, '').slice(0, 24)
  return `tivra-${short}`
}

// Deterministic password from sessionId — same session always gets same password
// Students never see this — it's passed silently via the embed config
function getRoomPassword(sessionId: string): string {
  const chars = sessionId.replace(/-/g, '')
  // Take chars from middle of UUID for extra unpredictability
  return chars.slice(8, 16) + chars.slice(20, 24)
}

function getJitsiUrls(roomName: string, password: string) {
  const base = `https://${JITSI_HOST}/${roomName}`
  return { roomUrl: base, roomName, password }
}

// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
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
      .select('title, duration_minutes, daily_room_name, join_url')
      .eq('id', sessionId)
      .single()

    if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const s = sessionData as {
      title: string; duration_minutes: number
      daily_room_name: string | null; join_url: string | null
    }

    // Use existing room name or generate a new one
    const roomName   = s.daily_room_name ?? getRoomName(sessionId)
    const password   = getRoomPassword(sessionId)
    const { roomUrl } = getJitsiUrls(roomName, password)

    // Teacher URL — moderator with password set automatically
    const teacherUrl = `${roomUrl}#userInfo.displayName="${encodeURIComponent(user.full_name ?? 'Teacher')}"&config.startWithVideoMuted=false&config.startWithAudioMuted=false&config.prejoinPageEnabled=false&config.roomPasswordNumberOfDigits=false&password=${password}`

    // Save room info if not already saved
    if (!s.daily_room_name) {
      await sb.from('live_sessions').update({
        daily_room_name: roomName,
        daily_room_url:  roomUrl,
        join_url:        roomUrl,
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

    await sb.from('live_sessions').update({
      is_live:      false,
      is_completed: true,
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
      .select('daily_room_name, is_live, is_completed')
      .eq('id', sessionId)
      .single()

    if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const s = sessionData as {
      daily_room_name: string | null
      is_live: boolean; is_completed: boolean
    }

    if (s.is_completed) return NextResponse.json({ error: 'Session has ended' }, { status: 410 })
    if (!s.daily_room_name) return NextResponse.json({ error: 'Room not ready yet' }, { status: 404 })

    const { roomUrl } = getJitsiUrls(s.daily_room_name, getRoomPassword(sessionId))

    // Student URL — muted, no video, password passed silently
    const password   = getRoomPassword(sessionId)
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
}
