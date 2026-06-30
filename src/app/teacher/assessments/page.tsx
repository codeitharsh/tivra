export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import TeacherAssessmentsClient from './TeacherAssessmentsClient'
import type { Profile } from '@/types/database'

export default async function TeacherAssessmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch phases — previously fetched with no programme info at all,
  // meaning if a second programme's phases ever existed they'd show
  // up mixed in with no way to tell which programme each belonged to,
  // and the hardcoded "phase 1 vs phase 2" placeholder defaults below
  // assumed exactly Cloud LaunchPad's 2-phase structure. Now includes
  // programme name/slug so the client can group and label correctly.
  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, program_id, programs!program_id(name, slug)')
    .order('program_id')
    .order('phase_number')

  // Same Supabase to-one-join shape ambiguity as elsewhere in this
  // codebase — handled defensively rather than relying on tsc to
  // catch every instance (it didn't catch this particular one).
  type PhaseRow = {
    id: string; title: string; phase_number: number; program_id: string
    programs: { name: string; slug: string } | { name: string; slug: string }[] | null
  }
  const phases = ((phasesRaw ?? []) as unknown as PhaseRow[]).map(row => ({
    ...row,
    programs: Array.isArray(row.programs) ? (row.programs[0] ?? null) : row.programs,
  }))

  // Fetch assessments with phase info
  const { data: assessmentsRaw } = await admin
    .from('assessments')
    .select('*, phases!phase_id(title, phase_number)')
    .in('phase_id', phases.map(p => p.id))

  const assessments = (assessmentsRaw ?? []) as Record<string, unknown>[]

  // Question counts per assessment
  const { data: qRaw } = await admin
    .from('assessment_questions')
    .select('assessment_id')

  const qCountMap: Record<string, number> = {}
  for (const q of (qRaw ?? []) as { assessment_id: string }[])
    qCountMap[q.assessment_id] = (qCountMap[q.assessment_id] ?? 0) + 1

  // Attempt counts per assessment
  const { data: aRaw } = await admin
    .from('assessment_attempts')
    .select('assessment_id')

  const aCountMap: Record<string, number> = {}
  for (const a of (aRaw ?? []) as { assessment_id: string }[])
    aCountMap[a.assessment_id] = (aCountMap[a.assessment_id] ?? 0) + 1

  const enriched = assessments.map(a => ({
    ...a,
    question_count: qCountMap[a.id as string] ?? 0,
    attempt_count:  aCountMap[a.id as string] ?? 0,
  }))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title="Phase Assessments"
          subtitle="Create assessments, add questions, set unlock schedules"
        />
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <TeacherAssessmentsClient
            phases={phases}
            assessments={enriched}
          />
        </div>
      </main>
    </div>
  )
}
