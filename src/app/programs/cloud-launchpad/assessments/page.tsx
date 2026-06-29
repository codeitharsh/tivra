export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { requireActiveStudent } from '@/lib/access-gate'
import type { Profile } from '@/types/database'

export default async function AssessmentsPage() {
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

  const { data: program } = await admin
    .from('programs').select('id').eq('slug', 'cloud-launchpad').single()

  // Phases with module counts
  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, modules(id)')
    .eq('program_id', (program as {id:string}|null)?.id ?? '')
    .order('phase_number')

  const phases = (phasesRaw ?? []) as {
    id: string; title: string; phase_number: number
    modules: { id: string }[]
  }[]

  // Student module progress
  const { data: progressRaw } = await supabase
    .from('module_progress')
    .select('module_id, status')
    .eq('student_id', user.id)

  const completedSet = new Set(
    (progressRaw as { module_id: string; status: string }[] ?? [])
      .filter(p => p.status === 'completed')
      .map(p => p.module_id)
  )

  // Assessments
  const { data: assessmentsRaw } = await admin
    .from('assessments')
    .select('*')
    .in('phase_id', phases.map(p => p.id))

  const assessments = (assessmentsRaw ?? []) as {
    id: string; phase_id: string; title: string
    total_questions: number; duration_minutes: number; passing_percent: number
    unlock_datetime: string | null; is_manually_unlocked: boolean
  }[]

  // Student assessment attempts
  const { data: attemptsRaw } = await supabase
    .from('assessment_attempts')
    .select('assessment_id, score_percent, passed, submitted_at')
    .eq('student_id', user.id)

  const attemptMap = new Map(
    (attemptsRaw as { assessment_id: string; score_percent: number; passed: boolean; submitted_at: string }[] ?? [])
      .map(a => [a.assessment_id, a])
  )

  // Certificates
  const { data: certsRaw } = await supabase
    .from('certificates')
    .select('phase_id, score_percent, issued_at')
    .eq('student_id', user.id)
    .eq('is_revoked', false)

  const certMap = new Map(
    (certsRaw as { phase_id: string; score_percent: number; issued_at: string }[] ?? [])
      .map(c => [c.phase_id, c])
  )

  // Phase 1 pass check (for Phase 2 eligibility)
  const phase1Assessment = assessments.find(a => {
    const ph = phases.find(p => p.id === a.phase_id)
    return ph?.phase_number === 1
  })
  const phase1Passed = phase1Assessment
    ? attemptMap.get(phase1Assessment.id)?.passed === true
    : false

  const now = new Date()

  const phaseColors = [
    { gradient: 'linear-gradient(135deg,rgba(255,107,35,0.08),rgba(245,158,11,0.05))', border: 'rgba(255,107,35,0.25)', accent: '#ff6b23' },
    { gradient: 'linear-gradient(135deg,rgba(0,212,170,0.05),rgba(59,91,219,0.05))',   border: 'rgba(0,212,170,0.2)',  accent: 'var(--teal)' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="Assessments" subtitle="Score ≥ 75% to earn your certificate"/>
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

          {/* Phase assessment cards */}
          <div style={{ display:'grid', marginBottom: '24px' }}>
            {phases.map((phase, pi) => {
              const assessment = assessments.find(a => a.phase_id === phase.id)
              const attempt    = assessment ? attemptMap.get(assessment.id) : null
              const cert       = certMap.get(phase.id)
              const colors     = phaseColors[pi]

              // Module completion check
              const phaseModuleIds   = phase.modules.map(m => m.id)
              const completedCount   = phaseModuleIds.filter(id => completedSet.has(id)).length
              const allModulesDone   = completedCount === phaseModuleIds.length && phaseModuleIds.length > 0
              const modulePct        = phaseModuleIds.length > 0
                ? Math.round((completedCount / phaseModuleIds.length) * 100) : 0

              // Lock conditions
              const scheduleOk = !assessment
                ? false
                : assessment.is_manually_unlocked ||
                  (assessment.unlock_datetime ? now >= new Date(assessment.unlock_datetime) : false)

              const phase2EligOk = pi === 0 ? true : phase1Passed

              const canAttempt = allModulesDone && scheduleOk && phase2EligOk && !attempt

              let lockReason = ''
              if (!phase2EligOk) lockReason = 'Pass Phase 1 assessment first'
              else if (!allModulesDone) lockReason = `Complete all ${phaseModuleIds.length} modules (${completedCount}/${phaseModuleIds.length} done)`
              else if (!scheduleOk) lockReason = 'Waiting for admin to unlock'

              return (
                <div key={phase.id} className="card" style={{
                  background: colors.gradient, borderColor: colors.border,
                  padding: '24px', position: 'relative',
                }}>
                  <div style={{
                    fontSize: '11px', color: colors.accent,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
                  }}>
                    Phase {phase.phase_number} Assessment
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>
                    {phase.title}
                  </div>

                  {assessment && (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                      {assessment.total_questions} questions · {assessment.duration_minutes} min · Pass: {assessment.passing_percent}%
                    </div>
                  )}

                  {/* Progress toward unlock */}
                  {!attempt && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: '11px', color: 'var(--muted)', marginBottom: '5px',
                      }}>
                        <span>Modules completed</span>
                        <span>{modulePct}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{
                          width: `${modulePct}%`, background: colors.gradient,
                        }}/>
                      </div>
                    </div>
                  )}

                  {/* Result if attempted */}
                  {attempt && (
                    <div style={{
                      background: attempt.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${attempt.passed ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`,
                      borderRadius: '10px', padding: '14px', marginBottom: '16px',
                      textAlign: 'center',
                    }}>
                      <div style={{
                        fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '32px',
                        color: attempt.passed ? 'var(--green)' : 'var(--red)',
                      }}>
                        {Math.round(attempt.score_percent)}%
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                        {attempt.passed ? '🏆 Passed — Certificate issued' : '✗ Below passing mark'}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {!assessment ? (
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No assessment configured yet.</div>
                  ) : canAttempt ? (
                    <Link
                      href={`/programs/cloud-launchpad/assessments/${assessment.id}`}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '14px' }}
                    >
                      Start Assessment →
                    </Link>
                  ) : attempt ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Link
                        href={`/programs/cloud-launchpad/assessments/${assessment.id}`}
                        className="btn btn-ghost"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '13px' }}
                      >
                        Review Answers
                      </Link>
                      {cert && (
                        <Link
                          href="/programs/cloud-launchpad/certificate"
                          className="btn btn-primary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '13px' }}
                        >
                          🏆 View Certificate
                        </Link>
                      )}
                    </div>
                  ) : (
                    <button disabled className="btn btn-ghost" style={{
                      width: '100%', justifyContent: 'center', fontSize: '13px', opacity: 0.55,
                    }}>
                      🔒 {lockReason}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Certificate eligibility */}
          <div className="card">
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', marginBottom: '16px' }}>
              Certificate Eligibility
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {phases.map(phase => {
                const assessment = assessments.find(a => a.phase_id === phase.id)
                const attempt    = assessment ? attemptMap.get(assessment.id) : null
                const cert       = certMap.get(phase.id)
                return (
                  <div key={phase.id} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: cert ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px', flexShrink: 0,
                    }}>
                      {cert ? '🏆' : '🔒'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>
                        Phase {phase.phase_number}: {phase.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Score ≥ {assessment?.passing_percent ?? 75}% in the phase assessment
                      </div>
                    </div>
                    {cert ? (
                      <span className="pill pill-active">
                        {Math.round(cert.score_percent)}% — Earned ✓
                      </span>
                    ) : attempt && !attempt.passed ? (
                      <span className="pill pill-pending">
                        {Math.round(attempt.score_percent)}% — Below pass mark
                      </span>
                    ) : (
                      <span className="pill pill-locked">Pending</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
