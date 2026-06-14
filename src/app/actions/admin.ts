'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSB } from '@supabase/supabase-js'

function getAdmin() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Auth guard — verifies caller is admin ─────────────────────
async function requireAdmin(): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if ((profile as { role: string } | null)?.role !== 'admin') {
    return { error: 'Forbidden' }
  }
  return { id: user.id }
}

// ── Auth guard — verifies caller is admin OR teacher ──────────
async function requireStaff(): Promise<{ id: string; role: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role
  if (!role || !['admin', 'teacher'].includes(role)) {
    return { error: 'Forbidden' }
  }
  return { id: user.id, role }
}

// ── Grant access ──────────────────────────────────────────────
export async function grantAccess(formData: FormData) {
  const caller = await requireAdmin()
  if ('error' in caller) return { error: caller.error }

  const sb        = getAdmin()
  const studentId = formData.get('student_id') as string
  const notes     = formData.get('notes')      as string | null
  const role      = (formData.get('role') as string) || 'student'

  if (!studentId) return { error: 'Missing student_id' }

  const batchId = formData.get('batch_id') as string | null

  const updatePayload: Record<string, unknown> = {
    access_status:       'active',
    role,
    payment_verified_at: new Date().toISOString(),
    payment_verified_by: caller.id,
    payment_notes:       notes ?? null,
  }
  if (batchId) updatePayload.batch_id = batchId

  const { error } = await sb
    .from('profiles')
    .update(updatePayload)
    .eq('id', studentId)

  if (error) return { error: error.message }

  await sb
    .from('payment_requests')
    .update({
      status:      'approved',
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('student_id', studentId)
    .eq('status', 'pending')

  revalidatePath('/admin/access')
  revalidatePath('/admin/students')
  revalidatePath('/admin/payments')
  return { success: true }
}

// ── Revoke access ─────────────────────────────────────────────
export async function revokeAccess(studentId: string) {
  const caller = await requireAdmin()
  if ('error' in caller) return { error: caller.error }

  const sb = getAdmin()
  const { error } = await sb
    .from('profiles')
    .update({ access_status: 'restricted' } as Record<string, unknown>)
    .eq('id', studentId)

  if (error) return { error: error.message }

  revalidatePath('/admin/access')
  revalidatePath('/admin/students')
  return { success: true }
}

// ── Change role ───────────────────────────────────────────────
export async function changeRole(studentId: string, newRole: string) {
  const caller = await requireAdmin()
  if ('error' in caller) return { error: caller.error }

  const allowedRoles = ['student', 'teacher', 'parent', 'admin']
  if (!allowedRoles.includes(newRole)) return { error: 'Invalid role' }

  const sb = getAdmin()
  const { error } = await sb
    .from('profiles')
    .update({ role: newRole } as Record<string, unknown>)
    .eq('id', studentId)

  if (error) return { error: error.message }
  revalidatePath('/admin/students')
  revalidatePath('/admin/access')
  return { success: true }
}

// ── Reject payment ────────────────────────────────────────────
export async function rejectPayment(formData: FormData) {
  const caller = await requireAdmin()
  if ('error' in caller) return { error: caller.error }

  const sb        = getAdmin()
  const requestId = formData.get('request_id')      as string
  const note      = formData.get('rejection_note')  as string

  if (!requestId) return { error: 'Missing request_id' }

  const { error } = await sb
    .from('payment_requests')
    .update({
      status:         'rejected',
      reviewed_by:    caller.id,
      reviewed_at:    new Date().toISOString(),
      rejection_note: note,
    } as Record<string, unknown>)
    .eq('id', requestId)

  if (error) return { error: error.message }
  revalidatePath('/admin/payments')
  return { success: true }
}

// ── Attendance CSV export ─────────────────────────────────────
export async function getAttendanceCSV(sessionId?: string) {
  const caller = await requireStaff()
  if ('error' in caller) return { error: caller.error, csv: null }

  const sb = getAdmin()

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
  if (error) return { error: error.message, csv: null }

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

  return { csv, error: null }
}
