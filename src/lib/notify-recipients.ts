import type { SupabaseClient } from '@supabase/supabase-js'

export interface Recipient {
  id: string
  email: string
  full_name: string | null
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
}

function toRecipients(rows: ProfileRow[]): Recipient[] {
  return rows
    .filter((p): p is ProfileRow & { email: string } => !!p.email)
    .map(p => ({ id: p.id, email: p.email, full_name: p.full_name }))
}

// Active students enrolled in a given programme — the audience for
// notes/test/assessment notifications, none of which have a batch
// concept at all (only live_sessions does). profiles.batch_id is
// optional, so resolving via enrolled_programs (not batches) is the
// only way to reach every relevant student, including ones with no
// batch assigned.
export async function getRecipientsForProgram(sb: SupabaseClient, programId: string): Promise<Recipient[]> {
  const { data: enrollments } = await sb
    .from('enrolled_programs')
    .select('student_id')
    .eq('program_id', programId)

  const studentIds = (enrollments ?? []).map(e => (e as { student_id: string }).student_id)
  if (studentIds.length === 0) return []

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, email, full_name')
    .in('id', studentIds)
    .eq('role', 'student')
    .eq('access_status', 'active')

  return toRecipients((profiles ?? []) as ProfileRow[])
}

// Active students assigned to a specific batch.
export async function getRecipientsForBatch(sb: SupabaseClient, batchId: string): Promise<Recipient[]> {
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, email, full_name')
    .eq('batch_id', batchId)
    .eq('role', 'student')
    .eq('access_status', 'active')

  return toRecipients((profiles ?? []) as ProfileRow[])
}

// Recipients for a live session — mirrors checkLiveSessionAccess's own
// resolution order (src/lib/live-session-access.ts): a batch match is
// sufficient on its own; otherwise fall back to programme enrollment
// resolved via program_id or phase_id. A session with neither signal
// (the fully-open "general call" case) deliberately notifies nobody
// rather than every active student on the platform — an unscoped form
// field shouldn't silently turn into a mass email.
export async function getRecipientsForSession(
  sb: SupabaseClient,
  session: { batchId: string | null; phaseId: string | null; programId: string | null }
): Promise<Recipient[]> {
  if (session.batchId) return getRecipientsForBatch(sb, session.batchId)

  let programId = session.programId
  if (!programId && session.phaseId) {
    const { data } = await sb.from('phases').select('program_id').eq('id', session.phaseId).single()
    programId = (data as { program_id: string } | null)?.program_id ?? null
  }

  if (!programId) return []
  return getRecipientsForProgram(sb, programId)
}
