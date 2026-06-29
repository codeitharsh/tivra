export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CountdownCell from './CountdownCell'
import { requireActiveStudent } from '@/lib/access-gate'
import type { Profile } from '@/types/database'

export default async function TestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  // Defense-in-depth — see src/lib/access-gate.ts for why this exists
  // alongside proxy.ts middleware.
  requireActiveStudent(profile)

  const admin = createAdminClient()

  // Fetch program
  const { data: program } = await admin
    .from('programs').select('id').eq('slug', 'cloud-launchpad').single()

  // Fetch all weekly tests
  const { data: testsRaw } = await admin
    .from('weekly_tests')
    .select('*, phases(title, phase_number)')
    .eq('program_id', (program as {id:string}|null)?.id ?? '')
    .order('phase_id')
    .order('week_number')

  // Fetch student attempts
  const { data: attemptsRaw } = await supabase
    .from('test_attempts')
    .select('test_id, score_percent')
    .eq('student_id', user.id)

  const attemptMap = new Map<string, number>(
    (attemptsRaw as { test_id: string; score_percent: number }[] ?? [])
      .map(a => [a.test_id, a.score_percent])
  )

  const now = new Date()

  const tests = (testsRaw ?? []) as {
    id: string; week_number: number; title: string; topic: string | null
    unlock_datetime: string | null; duration_minutes: number
    is_manually_unlocked: boolean
    phases: { title: string; phase_number: number } | null
  }[]

  function getTestStatus(t: typeof tests[0]) {
    if (attemptMap.has(t.id)) return 'completed'
    if (t.is_manually_unlocked) return 'open'
    if (!t.unlock_datetime) return 'locked'
    const unlockDate = new Date(t.unlock_datetime)
    if (now >= unlockDate) return 'open'
    return 'upcoming'
  }

  const statusConfig = {
    completed: { label: 'Completed', color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)',  dot: '●' },
    open:      { label: 'Open',      color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)',  dot: '●' },
    upcoming:  { label: 'Upcoming',  color: 'var(--amber)',  bg: 'rgba(245,158,11,0.12)', dot: '⏳' },
    locked:    { label: 'Locked',    color: 'var(--muted)',  bg: 'rgba(255,255,255,0.06)',dot: '🔒' },
  }

  const phase1Tests = tests.filter(t => t.phases?.phase_number === 1)
  const phase2Tests = tests.filter(t => t.phases?.phase_number === 2)

  const TestTable = ({ phaseTests, phaseNum }: { phaseTests: typeof tests; phaseNum: number }) => (
    <div className="card" style={{ marginBottom: '20px', padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px' }}>
          Phase {phaseNum} Weekly Tests
        </div>
        <span className="pill pill-in-progress" style={{ fontSize: '10px' }}>
          {phaseTests.filter(t => attemptMap.has(t.id)).length}/{phaseTests.length} completed
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Topic</th>
              <th>Unlocks</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Your Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {phaseTests.map(test => {
              const st    = getTestStatus(test)
              const cfg   = statusConfig[st]
              const score = attemptMap.get(test.id)

              return (
                <tr key={test.id}>
                  <td style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--muted)', fontSize: '12px' }}>
                    W{test.week_number}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: '13px' }}>
                    {test.topic ?? test.title}
                  </td>
                  <td>
                    {test.is_manually_unlocked ? (
                      <span style={{ fontSize: '12px', color: 'var(--green)' }}>Unlocked by admin</span>
                    ) : test.unlock_datetime ? (
                      st === 'upcoming' ? (
                        <CountdownCell unlockAt={test.unlock_datetime}/>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {new Date(test.unlock_datetime).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                          {' '}
                          {new Date(test.unlock_datetime).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Not scheduled</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {test.duration_minutes} min
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 10px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: 600,
                      background: cfg.bg, color: cfg.color,
                    }}>
                      {cfg.dot} {cfg.label}
                    </span>
                  </td>
                  <td>
                    {score !== undefined ? (
                      <span style={{
                        fontFamily: 'Syne, sans-serif', fontWeight: 700,
                        color: score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)',
                        fontSize: '14px',
                      }}>
                        {Math.round(score)}%
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td>
                    {st === 'open' && !attemptMap.has(test.id) && (
                      <Link
                        href={`/programs/cloud-launchpad/tests/${test.id}`}
                        className="btn btn-primary"
                        style={{ fontSize: '11px', padding: '6px 14px' }}
                      >
                        Take Test →
                      </Link>
                    )}
                    {st === 'completed' && (
                      <Link
                        href={`/programs/cloud-launchpad/tests/${test.id}`}
                        className="btn btn-ghost"
                        style={{ fontSize: '11px', padding: '6px 14px' }}
                      >
                        Review
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="Weekly Tests" subtitle="Tests unlock on admin-scheduled date and time"/>
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <div className="banner banner-info" style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>ℹ️</span>
            <span style={{ fontSize: '13px' }}>
              Tests unlock automatically when the scheduled date and time is reached.
              Each test can only be attempted once — your score is saved immediately on submission.
            </span>
          </div>
          <TestTable phaseTests={phase1Tests} phaseNum={1}/>
          <TestTable phaseTests={phase2Tests} phaseNum={2}/>
        </div>
      </main>
    </div>
  )
}
