import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import TeacherTestsClient from './TeacherTestsClient'
import type { Profile } from '@/types/database'

export default async function TeacherTestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch program id
  const { data: prog } = await admin
    .from('programs').select('id').eq('slug', 'cloud-launchpad').single()
  const programId = (prog as { id: string } | null)?.id ?? ''

  // Fetch phases with modules
  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, modules(id, title, module_number)')
    .eq('program_id', programId)
    .order('phase_number')

  const phases = (phasesRaw ?? []) as {
    id: string; title: string; phase_number: number
    modules: { id: string; title: string; module_number: number }[]
  }[]

  // Sort modules
  phases.forEach(p => {
    p.modules = (p.modules ?? []).sort((a, b) => a.module_number - b.module_number)
  })

  // Fetch all existing weekly tests with question counts
  const { data: testsRaw } = await admin
    .from('weekly_tests')
    .select('*, phases!phase_id(title, phase_number)')
    .eq('program_id', programId)
    .order('phase_id')
    .order('week_number')

  const tests = (testsRaw ?? []) as Record<string, unknown>[]

  // Fetch question counts per test
  const { data: qCountsRaw } = await admin
    .from('test_questions')
    .select('test_id')

  const qCountMap: Record<string, number> = {}
  for (const q of (qCountsRaw ?? []) as { test_id: string }[]) {
    qCountMap[q.test_id] = (qCountMap[q.test_id] ?? 0) + 1
  }

  // Fetch attempt counts per test (how many students have taken each)
  const { data: attemptsRaw } = await admin
    .from('test_attempts')
    .select('test_id')

  const attemptMap: Record<string, number> = {}
  for (const a of (attemptsRaw ?? []) as { test_id: string }[]) {
    attemptMap[a.test_id] = (attemptMap[a.test_id] ?? 0) + 1
  }

  const enrichedTests = tests.map(t => ({
    ...t,
    question_count: qCountMap[t.id as string] ?? 0,
    attempt_count:  attemptMap[t.id as string] ?? 0,
  }))

  // Stats
  const totalTests    = tests.length
  const totalQuestions = Object.values(qCountMap).reduce((a, b) => a + b, 0)
  const totalAttempts  = Object.values(attemptMap).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title="Weekly Tests"
          subtitle="Create tests, add questions, set unlock schedules"
        />
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Tests Created',   value: totalTests,     color: 'var(--cyan)'  },
              { label: 'Total Questions', value: totalQuestions, color: 'var(--green)' },
              { label: 'Total Attempts',  value: totalAttempts,  color: '#a78bfa'      },
            ].map(s => (
              <div key={s.label} className="card card-accent-top" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '28px',
                  color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <TeacherTestsClient
            phases={phases}
            tests={enrichedTests}
            programId={programId}
          />
        </div>
      </main>
    </div>
  )
}
