// Shared helper — checks whether a student has now passed every phase
// required by what they're enrolled in, and issues a single Programme
// Completion Certificate if so. Distinct from, and in addition to, the
// existing per-phase `certificates` table (untouched by this file).
//
// Called from submit-assessment right after a phase certificate is
// issued. Safe to call defensively even when nothing is actually
// complete yet — it just no-ops in that case.

import { createClient as createSB, type SupabaseClient } from '@supabase/supabase-js'

const PLAN_SLUGS: Record<string, string[]> = {
  cloud_launchpad: ['cloud-launchpad'],
  cloud_architect: ['cloud-architect'],
  bundle:          ['cloud-launchpad', 'cloud-architect'],
}

interface CompletionResult {
  issued: boolean
  plan?: string
  alreadyHad?: boolean
}

export async function checkAndIssueProgramCompletion(
  sb: SupabaseClient,
  studentId: string
): Promise<CompletionResult> {
  // 1. What is this student actually enrolled in? (written correctly by
  //    verify-payment today — this is the real source of truth, not the
  //    unused singular profiles.enrolled_program_id field.)
  const { data: enrollmentsRaw } = await sb
    .from('enrolled_programs')
    .select('program_id, plan, programs!program_id(slug)')
    .eq('student_id', studentId)

  // Same Supabase to-one-join shape ambiguity as my-programs/route.ts —
  // handled defensively rather than force-cast, since this result
  // directly drives certificate issuance and a silently wrong shape
  // here would be a real correctness bug, not just a lint warning.
  type EnrollmentRow = {
    program_id: string
    plan: string | null
    programs: { slug: string } | { slug: string }[] | null
  }
  const enrollments = ((enrollmentsRaw ?? []) as unknown as EnrollmentRow[]).map(row => ({
    program_id: row.program_id,
    plan: row.plan,
    programs: Array.isArray(row.programs) ? (row.programs[0] ?? null) : row.programs,
  }))

  if (enrollments.length === 0) return { issued: false }

  // Determine the plan to check. If the student has 2 enrolled_programs
  // rows (Bundle), treat the plan as 'bundle' regardless of what the
  // individual rows' plan column says (it's set to 'upfront' by the
  // payment flow, not the original plan name) — infer it from the
  // actual enrolled programme slugs instead, which is reliable.
  const enrolledSlugs = enrollments
    .map(e => e.programs?.slug)
    .filter((s): s is string => !!s)

  let inferredPlan: string | null = null
  if (enrolledSlugs.includes('cloud-launchpad') && enrolledSlugs.includes('cloud-architect')) {
    inferredPlan = 'bundle'
  } else if (enrolledSlugs.includes('cloud-architect')) {
    inferredPlan = 'cloud_architect'
  } else if (enrolledSlugs.includes('cloud-launchpad')) {
    inferredPlan = 'cloud_launchpad'
  }

  if (!inferredPlan) return { issued: false }

  // 2. Already has a completion certificate for this exact plan? Don't
  //    re-issue — the unique index on (student_id, plan) would reject
  //    the insert anyway, but checking first avoids a wasted query
  //    chain and lets us return a clean "already had it" signal.
  const { data: existing } = await sb
    .from('program_completions')
    .select('id')
    .eq('student_id', studentId)
    .eq('plan', inferredPlan)
    .maybeSingle()

  if (existing) return { issued: false, alreadyHad: true, plan: inferredPlan }

  // 3. Find every phase belonging to the programme(s) this plan requires.
  const requiredSlugs = PLAN_SLUGS[inferredPlan] ?? []
  const { data: programsRaw } = await sb
    .from('programs')
    .select('id, slug')
    .in('slug', requiredSlugs)

  const programIds = ((programsRaw ?? []) as { id: string; slug: string }[]).map(p => p.id)
  if (programIds.length === 0) return { issued: false }

  const { data: phasesRaw } = await sb
    .from('phases')
    .select('id, program_id')
    .in('program_id', programIds)

  const requiredPhaseIds = ((phasesRaw ?? []) as { id: string; program_id: string }[]).map(p => p.id)
  if (requiredPhaseIds.length === 0) return { issued: false }

  // 4. Has the student passed a phase certificate for every required phase?
  const { data: certsRaw } = await sb
    .from('certificates')
    .select('phase_id')
    .eq('student_id', studentId)
    .eq('is_revoked', false)
    .in('phase_id', requiredPhaseIds)

  const passedPhaseIds = new Set(
    ((certsRaw ?? []) as { phase_id: string | null }[])
      .map(c => c.phase_id)
      .filter((id): id is string => !!id)
  )

  const allPhasesPassed = requiredPhaseIds.every(id => passedPhaseIds.has(id))
  if (!allPhasesPassed) return { issued: false }

  // 5. Every required phase is passed — issue the completion certificate.
  //    onConflict guards against a race if two requests trigger this
  //    near-simultaneously (e.g. two tabs submitting assessments).
  const { error } = await sb.from('program_completions').upsert({
    student_id:          studentId,
    program_id:          programIds.length === 1 ? programIds[0] : null,
    plan:                inferredPlan,
    phase_ids_completed: requiredPhaseIds,
  }, { onConflict: 'student_id,plan' })

  if (error) {
    console.error('[program-completion] insert failed:', error.message)
    return { issued: false }
  }

  // 6. Notify the student — reuses the existing notifications table.
  await sb.from('notifications').insert({
    user_id: studentId,
    title:   '🏆 Programme completed — your certificate is ready!',
    body:    'You\u2019ve passed every assessment in your programme. Download your completion certificate now.',
    type:    'success',
    link:    '/certificate',
  })

  return { issued: true, plan: inferredPlan }
}

export function adminSBForCompletions() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
