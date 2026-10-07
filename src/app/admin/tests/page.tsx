export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import TestSchedulerClient from './TestSchedulerClient'
import type { Profile } from '@/types/database'

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { program: requestedSlug } = await searchParams

  // Previously hardcoded to 'cloud-launchpad' — same bug already fixed
  // in teacher/tests and teacher/curriculum. This is a SEPARATE admin-
  // only page (test scheduling/unlock overrides) from teacher/tests
  // (test creation/question authoring) — genuinely different
  // functionality sharing the TestSchedulerClient component, not a
  // true duplicate — but it had the identical single-programme bug.
  const { data: allProgramsRaw } = await admin
    .from('programs')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')

  const allPrograms = (allProgramsRaw ?? []) as { id: string; name: string; slug: string }[]

  const selectedProgram = requestedSlug
    ? allPrograms.find(p => p.slug === requestedSlug) ?? allPrograms[0]
    : allPrograms[0]

  const { data: testsRaw } = selectedProgram ? await admin
    .from('weekly_tests')
    .select('*, phases!phase_id(title, phase_number)')
    .eq('program_id', selectedProgram.id)
    .order('phase_id').order('week_number') : { data: [] }

  const tests = (testsRaw ?? []) as Record<string, unknown>[]

  return (
    <AuthShell
      profile={profile}
      title="Test Scheduling"
      subtitle={selectedProgram ? `Set unlock dates and manually override tests · ${selectedProgram.name}` : 'No programmes found'}
    >
          {allPrograms.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {allPrograms.map(p => (
                <Link
                  key={p.id}
                  href={`/admin/tests?program=${p.slug}`}
                  className={p.id === selectedProgram?.id ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{ fontSize: '13px' }}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}

          {selectedProgram ? (
            <TestSchedulerClient tests={tests}/>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              No active programmes found. Create one in the admin panel first.
            </div>
          )}
    </AuthShell>
  )
}
