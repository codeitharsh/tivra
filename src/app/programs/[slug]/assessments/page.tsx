export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { requireActiveStudent } from '@/lib/access-gate'
import { requireProgramAccess } from '@/lib/program-access'
import type { Profile } from '@/types/database'
import { Trophy, Lock, X, ArrowRight, Award } from 'lucide-react'

const PHASE_PALETTE = [
  { accent: 'var(--amber)' },
  { accent: 'var(--accent-2)' },
  { accent: 'var(--accent)' },
  { accent: 'var(--green)' },
]

export default async function AssessmentsPage({
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

  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, modules(id)')
    .eq('program_id', program.id)
    .order('phase_number')

  const phases = ((phasesRaw ?? []) as {
    id: string; title: string; phase_number: number
    modules: { id: string }[]
  }[]).sort((a, b) => a.phase_number - b.phase_number)

  const { data: progressRaw } = await supabase
    .from('module_progress')
    .select('module_id, status')
    .eq('student_id', user.id)

  const completedSet = new Set(
    (progressRaw as { module_id: string; status: string }[] ?? [])
      .filter(p => p.status === 'completed')
      .map(p => p.module_id)
  )

  const { data: assessmentsRaw } = await admin
    .from('assessments')
    .select('*')
    .in('phase_id', phases.map(p => p.id))

  const assessments = (assessmentsRaw ?? []) as {
    id: string; phase_id: string; title: string
    total_questions: number; duration_minutes: number; passing_percent: number
    unlock_datetime: string | null; is_manually_unlocked: boolean
  }[]

  const { data: attemptsRaw } = await supabase
    .from('assessment_attempts')
    .select('assessment_id, score_percent, passed, submitted_at')
    .eq('student_id', user.id)

  const attemptMap = new Map(
    (attemptsRaw as { assessment_id: string; score_percent: number; passed: boolean; submitted_at: string }[] ?? [])
      .map(a => [a.assessment_id, a])
  )

  const { data: certsRaw } = await supabase
    .from('certificates')
    .select('phase_id, score_percent, issued_at')
    .eq('student_id', user.id)
    .eq('is_revoked', false)

  const certMap = new Map(
    (certsRaw as { phase_id: string; score_percent: number; issued_at: string }[] ?? [])
      .map(c => [c.phase_id, c])
  )

  // Generic sequential eligibility: phase N's assessment is only
  // attemptable once phase N-1's assessment has been PASSED — not
  // just hardcoded to "phase 1 unlocks phase 2." Works for any number
  // of phases.
  const phasePassedMap = new Map<string, boolean>()
  phases.forEach(phase => {
    const a = assessments.find(x => x.phase_id === phase.id)
    phasePassedMap.set(phase.id, a ? attemptMap.get(a.id)?.passed === true : false)
  })

  const now = new Date()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="Assessments" subtitle={`${program.name} — Score ≥ 75% to earn your certificate`}/>
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

          <div style={{ display:'grid', marginBottom: '24px' }}>
            {phases.map((phase, pi) => {
              const assessment = assessments.find(a => a.phase_id === phase.id)
              const attempt    = assessment ? attemptMap.get(assessment.id) : null
              const cert       = certMap.get(phase.id)
              const colors     = PHASE_PALETTE[pi % PHASE_PALETTE.length]

              const phaseModuleIds   = phase.modules.map(m => m.id)
              const completedCount   = phaseModuleIds.filter(id => completedSet.has(id)).length
              const allModulesDone   = completedCount === phaseModuleIds.length && phaseModuleIds.length > 0
              const modulePct        = phaseModuleIds.length > 0
                ? Math.round((completedCount / phaseModuleIds.length) * 100) : 0

              const scheduleOk = !assessment
                ? false
                : assessment.is_manually_unlocked ||
                  (assessment.unlock_datetime ? now >= new Date(assessment.unlock_datetime) : false)

              // First phase (lowest phase_number) has no prerequisite;
              // every subsequent phase requires the PREVIOUS phase's
              // assessment to be passed.
              const prevPhase = pi > 0 ? phases[pi - 1] : null
              const phaseEligOk = !prevPhase || (phasePassedMap.get(prevPhase.id) ?? false)

              const canAttempt = allModulesDone && scheduleOk && phaseEligOk && !attempt

              let lockReason = ''
              if (!phaseEligOk) lockReason = `Pass Phase ${prevPhase?.phase_number} assessment first`
              else if (!allModulesDone) lockReason = `Complete all ${phaseModuleIds.length} modules (${completedCount}/${phaseModuleIds.length} done)`
              else if (!scheduleOk) lockReason = 'Waiting for admin to unlock'

              return (
                <div key={phase.id} className="card" style={{
                  padding: '24px', position: 'relative', borderTop: `2px solid ${colors.accent}`,
                }}>
                  <div className="stat-label" style={{ color: colors.accent, marginBottom: '8px' }}>
                    Phase {phase.phase_number} assessment
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '18px', marginBottom: '6px' }}>
                    {phase.title}
                  </div>

                  {assessment && (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                      {assessment.total_questions} questions · {assessment.duration_minutes} min · Pass: {assessment.passing_percent}%
                    </div>
                  )}

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
                          width: `${modulePct}%`, background: colors.accent,
                        }}/>
                      </div>
                    </div>
                  )}

                  {attempt && (
                    <div style={{
                      background: attempt.passed ? 'var(--green-dim)' : 'var(--red-dim)',
                      border: `1px solid ${attempt.passed ? 'rgba(74,222,128,0.25)' : 'rgba(240,69,58,0.2)'}`,
                      borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px',
                      textAlign: 'center',
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '32px',
                        color: attempt.passed ? 'var(--green)' : 'var(--red)',
                      }}>
                        {Math.round(attempt.score_percent)}%
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                        {attempt.passed ? <><Trophy size={12}/> Passed — certificate issued</> : <><X size={12}/> Below passing mark</>}
                      </div>
                    </div>
                  )}

                  {!assessment ? (
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No assessment configured yet.</div>
                  ) : canAttempt ? (
                    <Link
                      href={`/programs/${slug}/assessments/${assessment.id}`}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '14px' }}
                    >
                      Start assessment <ArrowRight size={14}/>
                    </Link>
                  ) : attempt ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Link
                        href={`/programs/${slug}/assessments/${assessment.id}`}
                        className="btn btn-ghost"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '13px' }}
                      >
                        Review answers
                      </Link>
                      {cert && (
                        <Link
                          href={`/programs/${slug}/certificate`}
                          className="btn btn-primary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '13px' }}
                        >
                          <Trophy size={13}/> View certificate
                        </Link>
                      )}
                    </div>
                  ) : (
                    <button disabled className="btn btn-ghost" style={{
                      width: '100%', justifyContent: 'center', fontSize: '13px', opacity: 0.55,
                    }}>
                      <Lock size={13}/> {lockReason}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="card">
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', marginBottom: '16px' }}>
              Certificate eligibility
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {phases.map(phase => {
                const assessment = assessments.find(a => a.phase_id === phase.id)
                const attempt    = assessment ? attemptMap.get(assessment.id) : null
                const cert       = certMap.get(phase.id)
                return (
                  <div key={phase.id} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--card2)', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '6px',
                      background: cert ? 'var(--green-dim)' : 'rgba(255,255,255,0.06)',
                      color: cert ? 'var(--green)' : 'var(--muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {cert ? <Trophy size={16}/> : <Lock size={16}/>}
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
                        <Award size={11}/> {Math.round(cert.score_percent)}% earned
                      </span>
                    ) : attempt && !attempt.passed ? (
                      <span className="pill pill-pending">
                        {Math.round(attempt.score_percent)}% — below pass mark
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
