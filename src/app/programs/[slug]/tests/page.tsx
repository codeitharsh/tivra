export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CountdownCell from './CountdownCell'
import { requireActiveStudent } from '@/lib/access-gate'
import { requireProgramAccess } from '@/lib/program-access'
import type { Profile } from '@/types/database'
import { Info, CheckCircle2, Clock, Lock, ArrowRight } from 'lucide-react'

type TestRow = {
  id: string; week_number: number; title: string; topic: string | null
  unlock_datetime: string | null; duration_minutes: number
  is_manually_unlocked: boolean; batch_id: string | null
  phases: { title: string; phase_number: number } | null
}

export default async function TestsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  requireActiveStudent(profile)

  const admin = createAdminClient()
  const program = await requireProgramAccess(admin, profile, slug)

  const { data: testsRaw } = await admin
    .from('weekly_tests')
    .select('*, phases(title, phase_number)')
    .eq('program_id', program.id)
    .order('phase_id')
    .order('week_number')

  const { data: attemptsRaw } = await supabase
    .from('test_attempts')
    .select('test_id, score_percent')
    .eq('student_id', user.id)

  const attemptMap = new Map<string, number>(
    (attemptsRaw as { test_id: string; score_percent: number }[] ?? [])
      .map(a => [a.test_id, a.score_percent])
  )

  const now = new Date()
  // A test with a batch_id only shows to students in that exact batch —
  // null batch_id (the default/unscoped case) stays visible programme-wide,
  // matching how a null-batch live_session is open to everyone enrolled.
  const tests = ((testsRaw ?? []) as TestRow[])
    .filter(t => !t.batch_id || t.batch_id === profile.batch_id)

  function getTestStatus(t: TestRow) {
    if (attemptMap.has(t.id)) return 'completed'
    if (t.is_manually_unlocked) return 'open'
    if (!t.unlock_datetime) return 'locked'
    const unlockDate = new Date(t.unlock_datetime)
    if (now >= unlockDate) return 'open'
    return 'upcoming'
  }

  const statusConfig = {
    completed: { label: 'Completed', cls: 'pill-active',   Icon: CheckCircle2 },
    open:      { label: 'Open',      cls: 'pill-open',     Icon: CheckCircle2 },
    upcoming:  { label: 'Upcoming',  cls: 'pill-upcoming', Icon: Clock },
    locked:    { label: 'Locked',    cls: 'pill-locked',   Icon: Lock },
  }

  // Group tests by phase_number dynamically — works for any number of
  // phases, instead of hardcoding exactly phase1Tests/phase2Tests.
  const phaseNumbers = Array.from(new Set(tests.map(t => t.phases?.phase_number).filter((n): n is number => n != null))).sort((a,b) => a-b)
  const testsByPhase = phaseNumbers.map(num => ({
    phaseNum: num,
    tests: tests.filter(t => t.phases?.phase_number === num),
  }))

  const TestTable = ({ phaseTests, phaseNum }: { phaseTests: TestRow[]; phaseNum: number }) => (
    <div className="card" style={{ marginBottom: '20px', padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px' }}>
          Phase {phaseNum} weekly tests
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
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--muted)', fontSize: '12px' }}>
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
                    <span className={`pill ${cfg.cls}`}>
                      <cfg.Icon size={11}/> {cfg.label}
                    </span>
                  </td>
                  <td>
                    {score !== undefined ? (
                      <span style={{
                        fontFamily: 'var(--font-serif)', fontWeight: 600,
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
                        href={`/programs/${slug}/tests/${test.id}`}
                        className="btn btn-primary"
                        style={{ fontSize: '11px', padding: '6px 14px' }}
                      >
                        Take test <ArrowRight size={12}/>
                      </Link>
                    )}
                    {st === 'completed' && (
                      <Link
                        href={`/programs/${slug}/tests/${test.id}`}
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
        <Topbar title="Weekly Tests" subtitle={`${program.name} — Tests unlock on admin-scheduled date and time`}/>
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <div className="banner banner-info">
            <Info size={16} style={{ flexShrink: 0 }}/>
            <span style={{ fontSize: '13px' }}>
              Tests unlock automatically when the scheduled date and time is reached.
              Each test can only be attempted once — your score is saved immediately on submission.
            </span>
          </div>
          {testsByPhase.map(({ phaseNum, tests: phaseTests }) => (
            <TestTable key={phaseNum} phaseTests={phaseTests} phaseNum={phaseNum}/>
          ))}
        </div>
      </main>
    </div>
  )
}
