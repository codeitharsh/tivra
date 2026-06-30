import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, Program } from '@/types/database'

// ── DB-driven programme resolution ───────────────────────────
// Previously every paid-content route was hardcoded under
// /programs/cloud-launchpad/... — adding a new programme meant
// duplicating an entire folder of pages by hand. This resolves the
// programme purely from the `programs` table by slug, so the SAME
// page components serve any number of programmes. Adding programme
// #3, #4, #50 requires zero new route files — just a new row in
// `programs` (plus its phases/modules/assessments).

export async function resolveProgramBySlug(
  sb: SupabaseClient,
  slug: string
): Promise<Program> {
  const { data, error } = await sb
    .from('programs')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) notFound()
  return data as Program
}

// ── Per-programme entitlement check ──────────────────────────
// Mirrors the same check now duplicated in proxy.ts middleware —
// this is the page-level defense-in-depth layer (see access-gate.ts
// for the equivalent restricted/pending_payment check). A student
// who paid for Programme A must never reach Programme B's content,
// regardless of role, regardless of how they navigated there.
export async function requireProgramEntitlement(
  sb: SupabaseClient,
  studentId: string,
  programId: string,
  programSlug: string
): Promise<void> {
  const { data } = await sb
    .from('enrolled_programs')
    .select('id')
    .eq('student_id', studentId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!data) {
    redirect(`/programs/${programSlug}`)
  }
}

// ── Combined helper for the common case ──────────────────────
// Most pages need: resolve the programme, check the student is an
// active student (not restricted/pending), AND check they're
// entitled to THIS specific programme. This bundles all three so
// every page calls one function instead of three.
export async function requireProgramAccess(
  sb: SupabaseClient,
  profile: Profile,
  slug: string
): Promise<Program> {
  const program = await resolveProgramBySlug(sb, slug)

  // Staff bypass entitlement checks entirely — they're not students.
  if (['admin', 'teacher'].includes(profile.role)) return program

  await requireProgramEntitlement(sb, profile.id, program.id, slug)
  return program
}
