import type { SupabaseClient } from '@supabase/supabase-js'

interface SessionAccessInput {
  batch_id:   string | null
  phase_id:   string | null
  program_id: string | null
}

export type AccessResult = { ok: true } | { ok: false; reason: string }

// Shared by the get_student_token API action and the /live pages — a
// student may join a live session only if:
//  1. the session isn't scoped to a different batch than the student's own
//  2. the session isn't scoped (directly or via its phase/batch) to a
//     programme the student isn't enrolled in
// Sessions with no batch/programme signal at all (general, open-to-all
// calls) remain open to any active student, matching how the scheduler
// UI's "All batches" / "No phase" options are meant to behave.
export async function checkLiveSessionAccess(
  sb: SupabaseClient,
  studentId: string,
  studentBatchId: string | null,
  session: SessionAccessInput
): Promise<AccessResult> {
  if (session.batch_id && session.batch_id !== studentBatchId) {
    return { ok: false, reason: 'This session is for a different batch.' }
  }

  let programId = session.program_id

  if (!programId && session.phase_id) {
    const { data } = await sb
      .from('phases').select('program_id').eq('id', session.phase_id).single()
    programId = (data as { program_id: string } | null)?.program_id ?? null
  }

  if (!programId && session.batch_id) {
    const { data } = await sb
      .from('batches').select('program_id').eq('id', session.batch_id).single()
    programId = (data as { program_id: string | null } | null)?.program_id ?? null
  }

  if (programId) {
    const { data: enrolled } = await sb
      .from('enrolled_programs')
      .select('id')
      .eq('student_id', studentId)
      .eq('program_id', programId)
      .maybeSingle()

    if (!enrolled) {
      return { ok: false, reason: 'You are not enrolled in the programme this session belongs to.' }
    }
  }

  return { ok: true }
}
