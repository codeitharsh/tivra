export const runtime = 'edge'

// One-time admin-triggered backfill: checks every active student against
// the same completion logic used going forward, and issues a Programme
// Completion Certificate for anyone who already qualifies today (i.e.
// passed every required phase BEFORE this feature existed). Safe to run
// more than once — checkAndIssueProgramCompletion no-ops for students who
// already have a completion certificate for their plan.
//
// Admin-only. Call once after deploying this feature, then it's no longer
// needed for new students (submit-assessment handles them automatically).

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { checkAndIssueProgramCompletion } from '@/lib/program-completion'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(): Promise<Response> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = adminSB()

  // Every student with at least one enrolled programme is a candidate —
  // checkAndIssueProgramCompletion itself figures out if they actually qualify.
  const { data: studentsRaw } = await sb
    .from('enrolled_programs')
    .select('student_id')

  const studentIds = Array.from(new Set(
    ((studentsRaw ?? []) as { student_id: string }[]).map(s => s.student_id)
  ))

  const results: { studentId: string; issued: boolean; plan?: string }[] = []
  for (const studentId of studentIds) {
    const result = await checkAndIssueProgramCompletion(sb, studentId)
    if (result.issued) {
      results.push({ studentId, issued: true, plan: result.plan })
    }
  }

  return NextResponse.json({
    success:          true,
    studentsChecked:  studentIds.length,
    certificatesIssued: results.length,
    issued:           results,
  })
}
