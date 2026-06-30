export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Mirrors the exact mapping in verify-payment/route.ts — kept in sync
// manually since this is a small, stable, infrequently-changed list.
// If a 3rd standalone programme is ever added, both files need the
// corresponding entry.
const PLAN_SLUGS: Record<string, string[]> = {
  cloud_launchpad: ['cloud-launchpad'],
  cloud_architect: ['cloud-architect'],
  bundle:          ['cloud-launchpad', 'cloud-architect'],
}

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Auth guards ──────────────────────────────────────────────
async function getCallerRole(): Promise<{ id: string; role: string } | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (!role) return null
  return { id: user.id, role }
}

async function requireAdmin() {
  const caller = await getCallerRole()
  if (!caller || caller.role !== 'admin') return null
  return caller
}

async function requireStaff() {
  const caller = await getCallerRole()
  if (!caller || !['admin', 'teacher'].includes(caller.role)) return null
  return caller
}

// ══════════════════════════════════════════════════════════════
//  POST — grantAccess, revokeAccess, changeRole, rejectPayment
// ══════════════════════════════════════════════════════════════
export async function POST(req: Request): Promise<Response> {
  try {

    const body = await req.json() as Record<string, unknown>
    const action = body.action as string

    // ── Grant Access ──────────────────────────────────────────
    // Previously this action ONLY set profiles.access_status = 'active'
    // and never wrote anything to enrolled_programs — meaning every
    // student manually activated by an admin (the original, pre-
    // Razorpay activation path, still used for offline/bank-transfer
    // payments and the AccessTable/PaymentsClient admin tools) ended
    // up with an active account but ZERO enrolled_programs rows. Every
    // per-programme entitlement check added elsewhere this session
    // (middleware, requireProgramAccess, submit-test/submit-assessment/
    // attendance) would have INCORRECTLY LOCKED OUT these legitimately
    // -paid students from their own content. Now creates the matching
    // enrolled_programs row(s) too, using the same plan→slug mapping
    // verify-payment already uses for the Razorpay path, so both
    // activation paths leave the database in the same correct state.
    if (action === 'grant_access') {
      const caller = await requireAdmin()
      if (!caller) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const studentId = body.student_id as string
      const notes     = (body.notes as string) ?? null
      const role      = (body.role   as string) ?? 'student'
      const batchId   = body.batch_id as string | undefined
      const plan      = body.plan as string | undefined

      if (!studentId) return Response.json({ error: 'Missing student_id' }, { status: 400 })

      const sb = adminSB()
      const updatePayload: Record<string, unknown> = {
        access_status:       'active',
        role,
        payment_verified_at: new Date().toISOString(),
        payment_verified_by: caller.id,
        payment_notes:       notes,
      }
      if (batchId) updatePayload.batch_id = batchId

      const { error } = await sb.from('profiles').update(updatePayload).eq('id', studentId)
      if (error) return Response.json({ error: error.message }, { status: 500 })

      // Create the enrolled_programs row(s) for whichever plan this
      // grant corresponds to. Only students with a role of 'student'
      // need a programme enrollment — promoting someone to teacher/
      // admin via this same action has nothing to enrol them in.
      if (plan && role === 'student') {
        const slugs = PLAN_SLUGS[plan] ?? [plan] // fall back: treat unknown plan values as a direct slug
        for (const slug of slugs) {
          const { data: prog } = await sb
            .from('programs').select('id').eq('slug', slug).maybeSingle()
          if (prog) {
            await sb.from('enrolled_programs').upsert({
              student_id:        studentId,
              program_id:        (prog as { id: string }).id,
              plan:              'manual_grant',
              amount_paid:       null,
              enrolled_at:       new Date().toISOString(),
              access_granted_at: new Date().toISOString(),
            }, { onConflict: 'student_id,program_id' })
          }
        }
      }

      await sb.from('payment_requests').update({
        status: 'approved', reviewed_by: caller.id, reviewed_at: new Date().toISOString(),
      }).eq('student_id', studentId).eq('status', 'pending')

      return Response.json({ success: true })
    }

    // ── Revoke Access ─────────────────────────────────────────
    if (action === 'revoke_access') {
      const caller = await requireAdmin()
      if (!caller) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const studentId = body.student_id as string
      if (!studentId) return Response.json({ error: 'Missing student_id' }, { status: 400 })

      const sb = adminSB()
      const { error } = await sb.from('profiles')
        .update({ access_status: 'restricted' }).eq('id', studentId)
      if (error) return Response.json({ error: error.message }, { status: 500 })

      return Response.json({ success: true })
    }

    // ── Change Role ───────────────────────────────────────────
    if (action === 'change_role') {
      const caller = await requireAdmin()
      if (!caller) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const studentId = body.student_id as string
      const newRole   = body.new_role   as string
      const allowedRoles = ['student', 'teacher', 'parent', 'admin']

      if (!studentId || !newRole) return Response.json({ error: 'Missing fields' }, { status: 400 })
      if (!allowedRoles.includes(newRole)) return Response.json({ error: 'Invalid role' }, { status: 400 })

      const sb = adminSB()
      const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', studentId)
      if (error) return Response.json({ error: error.message }, { status: 500 })

      return Response.json({ success: true })
    }

    // ── Reject Payment ────────────────────────────────────────
    if (action === 'reject_payment') {
      const caller = await requireAdmin()
      if (!caller) return Response.json({ error: 'Forbidden' }, { status: 403 })

      const requestId = body.request_id as string
      const note      = (body.rejection_note as string) ?? null

      if (!requestId) return Response.json({ error: 'Missing request_id' }, { status: 400 })

      const sb = adminSB()
      const { error } = await sb.from('payment_requests').update({
        status: 'rejected', reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(), rejection_note: note,
      }).eq('id', requestId)
      if (error) return Response.json({ error: error.message }, { status: 500 })

      return Response.json({ success: true })
    }

    // ── Attendance CSV export ─────────────────────────────────
    if (action === 'attendance_csv') {
      const caller = await requireStaff()
      if (!caller) return Response.json({ error: 'Forbidden', csv: null }, { status: 403 })

      const sessionId = body.session_id as string | undefined
      const sb = adminSB()

      let query = sb.from('v_attendance_export').select('*')
      if (sessionId) {
        query = sb
          .from('attendance_records')
          .select(`
            session_id,
            joined_at, left_at, duration_minutes, status,
            is_override, override_reason,
            profiles!student_id(full_name, email),
            live_sessions!session_id(title, scheduled_at, duration_minutes)
          `)
          .eq('session_id', sessionId) as typeof query
      }

      const { data, error } = await query
      if (error) return Response.json({ error: error.message, csv: null }, { status: 500 })

      const headers = [
        'Student Name', 'Email', 'Session', 'Session Date',
        'Joined At', 'Left At', 'Duration (mins)', 'Status', 'Override', 'Override Reason',
      ]
      const rows = (data ?? []).map((row: Record<string, unknown>) => [
        row.student_name ?? '', row.student_email ?? '',
        row.session_title ?? '', row.session_date
          ? new Date(row.session_date as string).toLocaleDateString('en-IN') : '',
        row.joined_at ? new Date(row.joined_at as string).toLocaleTimeString('en-IN') : 'Absent',
        row.left_at   ? new Date(row.left_at   as string).toLocaleTimeString('en-IN') : '-',
        row.attended_minutes ?? 0, row.status ?? 'absent',
        row.is_override ? 'Yes' : 'No', row.override_reason ?? '',
      ])

      const csv = [headers, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      return Response.json({ csv, error: null })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[admin] Unexpected error:', err)
    return Response.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
