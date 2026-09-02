export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import { Users, TrendingUp, Trophy } from 'lucide-react'

interface AttemptRow {
  id: string; student_id: string; score_percent: number | null; submitted_at: string
  profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
}

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

export default async function TestScoresPage({
  params,
}: { params: Promise<{ testId: string }> }) {
  const { testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: testRow } = await admin
    .from('weekly_tests')
    .select('id, title, topic, week_number, phases!phase_id(title, phase_number)')
    .eq('id', testId)
    .maybeSingle()
  if (!testRow) notFound()
  const test = testRow as {
    id: string; title: string; topic: string | null; week_number: number
    phases: { title: string; phase_number: number } | { title: string; phase_number: number }[] | null
  }
  const phase = one(test.phases)

  const { data: attemptsRaw } = await admin
    .from('test_attempts')
    .select('id, student_id, score_percent, submitted_at, profiles!student_id(full_name, email)')
    .eq('test_id', testId)
    .order('score_percent', { ascending: false })
  const attempts = (attemptsRaw ?? []) as AttemptRow[]

  const scores = attempts.map(a => a.score_percent ?? 0)
  const avgScore = scores.length === 0 ? 0 : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  const highScore = scores.length === 0 ? 0 : Math.round(Math.max(...scores))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title={`Week ${test.week_number} — ${test.topic ?? test.title}`}
          subtitle={phase ? `Phase ${phase.phase_number}: ${phase.title} — Scores` : 'Scores'}
        />
        <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

          <div style={{ marginBottom: '16px' }}>
            <Link href="/teacher/tests" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
              ← Back to weekly tests
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Users size={14} color="var(--accent-2)"/>
                <span className="stat-label">Attempts</span>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px' }}>{attempts.length}</div>
            </div>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <TrendingUp size={14} color="var(--green)"/>
                <span className="stat-label">Average score</span>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px' }}>{avgScore}%</div>
            </div>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Trophy size={14} color="var(--amber, #f59e0b)"/>
                <span className="stat-label">Highest score</span>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px' }}>{highScore}%</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>No attempts yet.</td></tr>
                  )}
                  {attempts.map(a => {
                    const p = one(a.profiles)
                    const score = Math.round(a.score_percent ?? 0)
                    return (
                      <tr key={a.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{p?.full_name ?? '—'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p?.email ?? '—'}</div>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 600, fontSize: '14px',
                            color: score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--amber, #f59e0b)' : 'var(--red)',
                          }}>{score}%</span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--muted)' }}>
                          {new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
