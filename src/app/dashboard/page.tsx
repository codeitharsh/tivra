export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ banner?: string }>
}) {
  const supabase = await createClient()
  const params   = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profileData) redirect('/login')
  const p = profileData as Profile

  // ── Role-based redirect ───────────────────────────────────
  // Admin and teacher have their own dashboards — never show them the student view
  if (p.role === 'admin')   redirect('/admin')
  if (p.role === 'teacher') redirect('/teacher')

  const isPending    = p.access_status === 'pending_payment'
  const isRestricted = p.access_status === 'restricted'
  const showPayBanner = isPending || params.banner === 'payment_required'

  const admin = createAdminClient()

  // ── Stats ────────────────────────────────────────────────
  const [
    { count: completedModules },
    { data: attemptsRaw },
    { data: assessAttemptsRaw },
    { data: certsRaw },
  ] = await Promise.all([
    supabase.from('module_progress').select('*',{count:'exact',head:true})
      .eq('student_id', user.id).eq('status','completed'),
    supabase.from('test_attempts').select('score_percent').eq('student_id', user.id),
    supabase.from('assessment_attempts').select('score_percent,passed,assessment_id')
      .eq('student_id', user.id).order('submitted_at',{ascending:false}),
    supabase.from('certificates').select('phase_id').eq('student_id', user.id).eq('is_revoked',false),
  ])

  const attempts   = (attemptsRaw ?? []) as { score_percent: number }[]
  const testsTaken = attempts.length
  const avgScore   = testsTaken > 0
    ? Math.round(attempts.reduce((s,a) => s + (a.score_percent??0), 0) / testsTaken)
    : 0

  const modulesCompleted = completedModules ?? 0
  const progress         = Math.round((modulesCompleted / 24) * 100)
  const streak           = p.streak_count ?? 0
  const certs            = (certsRaw ?? []) as { phase_id: string }[]

  // ── Upcoming tests ───────────────────────────────────────
  const { data: prog } = await admin.from('programs').select('id').eq('slug','cloud-launchpad').single()
  const { data: upcomingTestsRaw } = await admin
    .from('weekly_tests')
    .select('id, title, topic, week_number, unlock_datetime, duration_minutes, is_manually_unlocked')
    .eq('program_id', (prog as {id:string}|null)?.id ?? '')
    .order('unlock_datetime')
    .limit(10)

  const takenTestIds = new Set((attemptsRaw ?? []).map((_a: Record<string,unknown>) => ''))
  // Refetch attempts with test_id
  const { data: attemptsWithId } = await supabase
    .from('test_attempts').select('test_id').eq('student_id', user.id)
  const takenIds = new Set(((attemptsWithId??[]) as {test_id:string}[]).map(a => a.test_id))

  const now = new Date()
  type UpcomingTest = {
    id: string; title: string; topic: string|null; week_number: number
    duration_minutes: number; is_manually_unlocked: boolean; unlock_datetime: string|null
    isOpen: boolean; isUpcoming: boolean | null; unlockDt: Date | null
  }
  const upcomingTests: UpcomingTest[] = ((upcomingTestsRaw ?? []) as Record<string,unknown>[])
    .filter(t => !takenIds.has(t.id as string))
    .map(t => {
      const unlockDt   = t.unlock_datetime ? new Date(t.unlock_datetime as string) : null
      const isOpen     = !!(t.is_manually_unlocked) || (unlockDt ? now >= unlockDt : false)
      const isUpcoming = !isOpen && unlockDt && unlockDt > now
      return {
        id:                   t.id as string,
        title:                t.title as string,
        topic:                t.topic as string|null,
        week_number:          t.week_number as number,
        duration_minutes:     t.duration_minutes as number,
        is_manually_unlocked: t.is_manually_unlocked as boolean,
        unlock_datetime:      t.unlock_datetime as string|null,
        isOpen, isUpcoming, unlockDt,
      }
    })
    .filter(t => t.isOpen || t.isUpcoming)
    .slice(0, 3)

  // ── Upcoming live sessions ────────────────────────────────
  const { data: sessionsRaw } = await admin
    .from('live_sessions')
    .select('id, title, scheduled_at, duration_minutes, is_live')
    .eq('is_completed', false)
    .gte('scheduled_at', now.toISOString())
    .order('scheduled_at')
    .limit(2)

  const sessions = (sessionsRaw ?? []) as Record<string,unknown>[]

  // ── Phase assessment status ───────────────────────────────
  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, modules(id)')
    .order('phase_number')
  const phases = (phasesRaw ?? []) as { id:string; title:string; phase_number:number; modules:{id:string}[] }[]

  const { data: assessmentsRaw } = await admin
    .from('assessments')
    .select('id, phase_id, passing_percent, is_manually_unlocked, unlock_datetime')
    .in('phase_id', phases.map(p=>p.id))
  const assessments = (assessmentsRaw ?? []) as Record<string,unknown>[]

  const completedModuleIds = new Set(
    ((await supabase.from('module_progress').select('module_id').eq('student_id',user.id).eq('status','completed')).data ?? [])
      .map((m: Record<string,unknown>) => m.module_id as string)
  )
  const assessAttempts = (assessAttemptsRaw ?? []) as {score_percent:number; passed:boolean; assessment_id:string}[]

  const phaseStatus = phases.map(phase => {
    const phaseModuleIds  = phase.modules.map(m=>m.id)
    const doneCount       = phaseModuleIds.filter(id => completedModuleIds.has(id)).length
    const allDone         = doneCount === phaseModuleIds.length && phaseModuleIds.length > 0
    const assessment      = assessments.find(a => a.phase_id === phase.id)
    const aId             = assessment?.id as string|undefined
    const latestAttempt   = aId ? assessAttempts.find(a => a.assessment_id === aId) : null
    const hasCert         = certs.some(c => c.phase_id === phase.id)
    const scheduleOk      = assessment?.is_manually_unlocked ||
      (assessment?.unlock_datetime ? now >= new Date(assessment.unlock_datetime as string) : false)

    let statusLabel = ''
    let statusColor = ''
    if (hasCert) { statusLabel = '🏆 Certificate earned'; statusColor = 'var(--green)' }
    else if (latestAttempt && !latestAttempt.passed) { statusLabel = `${Math.round(latestAttempt.score_percent)}% — retake available`; statusColor = 'var(--amber)' }
    else if (!assessment) { statusLabel = 'Assessment not set up'; statusColor = 'var(--muted)' }
    else if (!allDone)    { statusLabel = `${doneCount}/${phaseModuleIds.length} modules done`; statusColor = 'var(--muted)' }
    else if (!scheduleOk) { statusLabel = 'Waiting for admin to unlock'; statusColor = 'var(--amber)' }
    else                  { statusLabel = '✓ Ready to take'; statusColor = 'var(--cyan)' }

    return { phase, assessment, hasCert, allDone, scheduleOk, statusLabel, statusColor, aId, doneCount, total: phaseModuleIds.length }
  })

  // Streak dots
  const streakDots = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7))

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={p}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar
          title="Dashboard"
          subtitle={`Welcome back, ${p.full_name?.split(' ')[0] ?? 'Student'} 👋`}
        />

        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          {/* ── Restricted banner ── */}
          {isRestricted && (
            <div className="banner banner-warning" style={{ marginBottom:'20px' }}>
              <span style={{ fontSize:'20px', flexShrink:0 }}>🔒</span>
              <div style={{ flex:1 }}>
                <strong>Your access has been suspended.</strong> Please contact support to resolve this.
              </div>
            </div>
          )}

          {/* ── Payment banner ── */}
          {showPayBanner && (
            <div className="banner banner-warning" style={{ marginBottom:'20px' }}>
              <span style={{ fontSize:'20px', flexShrink:0 }}>💳</span>
              <div style={{ flex:1 }}>
                <strong>Payment pending.</strong> Submit your payment details so our team can activate your account.
                Usually done within 24 hours.
              </div>
              <Link href="/payment" className="btn btn-primary"
                style={{ fontSize:'12px', padding:'8px 16px', flexShrink:0 }}>
                Submit Payment →
              </Link>
            </div>
          )}

          {/* ── Stats row ── */}
          <div className="grid-4 grid-2-keep" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
            {[
              { label:'Progress',        value:`${progress}%`,     color:'var(--green)', bar:progress },
              { label:'Modules Done',    value:`${modulesCompleted}/24`, color:'var(--teal)',  bar:null },
              { label:'Tests Taken',     value:String(testsTaken), color:'var(--blue)',   bar:null, sub: testsTaken>0?`Avg ${avgScore}%`:'No tests yet' },
              { label:'Streak',          value:`${streak} 🔥`,    color:'var(--amber)',  bar:null, sub:'Days in a row' },
            ].map(s => (
              <div key={s.label} className="card card-accent-top">
                <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase',
                  letterSpacing:'0.08em', marginBottom:'8px' }}>{s.label}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'26px',
                  color:s.color, lineHeight:1 }}>{s.value}</div>
                {s.bar !== null && s.bar !== undefined && (
                  <div className="progress-track" style={{ marginTop:'8px' }}>
                    <div className="progress-fill" style={{ width:`${s.bar}%` }}/>
                  </div>
                )}
                {s.sub && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Middle row ── */}
          <div style={{ display:'grid', marginBottom:'24px' }}>

            {/* Streak widget */}
            <div style={{
              background:'linear-gradient(135deg,rgba(74,222,128,0.06),rgba(245,158,11,0.04))',
              border:'1px solid rgba(74,222,128,0.15)',
              borderRadius:'var(--radius)', padding:'20px',
              display:'flex', alignItems:'center', gap:'18px',
            }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800,
                  fontSize:'48px', color:'var(--amber)', lineHeight:1 }}>
                  {streak}
                </div>
                <div style={{ fontSize:'9px', color:'var(--muted)', textTransform:'uppercase',
                  letterSpacing:'0.1em', marginTop:'4px' }}>Day streak</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', fontWeight:500, marginBottom:'10px' }}>
                  {streak >= 30 ? '🚀 One month! Unstoppable!'
                   : streak >= 14 ? '💪 Two weeks strong!'
                   : streak >= 7  ? '🔥 Amazing week streak!'
                   : streak > 0   ? 'Keep it up!'
                   : 'Start your streak today!'}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  {streakDots.map((done, i) => (
                    <div key={i} style={{
                      flex:1, height:'5px', borderRadius:'3px',
                      background: done ? 'var(--green)' : 'rgba(255,255,255,0.08)',
                      boxShadow: done ? '0 0 5px rgba(34,197,94,0.4)' : 'none',
                    }}/>
                  ))}
                </div>
                <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'6px' }}>
                  Mon – Sun this week
                </div>
              </div>
            </div>

            {/* Upcoming tests & sessions */}
            <div className="card">
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'14px',
                marginBottom:'14px', display:'flex', justifyContent:'space-between' }}>
                <span>Coming Up</span>
                <Link href="/programs/cloud-launchpad/tests"
                  style={{ fontSize:'11px', color:'var(--teal)', textDecoration:'none' }}>
                  All tests →
                </Link>
              </div>

              {isPending ? (
                <div style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'16px 0' }}>
                  🔒 Activate your account to see upcoming tests
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {upcomingTests.length === 0 && sessions.length === 0 ? (
                    <div style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'12px 0' }}>
                      ✓ All caught up!
                    </div>
                  ) : null}

                  {upcomingTests.map(t => (
                    <Link key={t.id as string}
                      href={t.isOpen ? `/programs/cloud-launchpad/tests/${t.id}` : '/programs/cloud-launchpad/tests'}
                      style={{ textDecoration:'none', display:'block' }}>
                      <div className="module-item" style={{
                        background: t.isOpen ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)',
                      }}>
                        <div className="mod-icon" style={{
                          background: t.isOpen ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                          color: t.isOpen ? 'var(--green)' : 'var(--amber)',
                        }}>📝</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'13px', fontWeight:500 }}>
                            Week {String(t.week_number)}: {String(t.topic ?? t.title ?? '')}
                          </div>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                            {String(t.duration_minutes ?? 30)} min
                          </div>
                        </div>
                        <span style={{
                          fontSize:'11px', fontWeight:600,
                          color: t.isOpen ? 'var(--green)' : 'var(--amber)',
                        }}>
                          {t.isOpen ? 'Open →' : t.unlockDt
                            ? `${new Date(t.unlockDt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`
                            : 'Soon'}
                        </span>
                      </div>
                    </Link>
                  ))}

                  {sessions.map(s => (
                    <Link key={s.id as string} href={`/live/${s.id}`}
                      style={{ textDecoration:'none', display:'block' }}>
                      <div className="module-item" style={{ background:'rgba(124,58,237,0.06)' }}>
                        <div className="mod-icon" style={{ background:'rgba(124,58,237,0.15)', color:'#a78bfa' }}>
                          {s.is_live ? '🔴' : '🎥'}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'13px', fontWeight:500 }}>{String(s.title??'')}</div>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                            {s.is_live ? 'Live now!'
                              : new Date(s.scheduled_at as string).toLocaleString('en-IN',{
                                  day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
                                })}
                          </div>
                        </div>
                        <span style={{ fontSize:'11px', color:'#a78bfa', fontWeight:600 }}>
                          {s.is_live ? '● Live' : 'Join →'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Phase assessment status ── */}
          <div className="card">
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'14px',
              marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Phase Assessments</span>
              <Link href="/programs/cloud-launchpad/assessments"
                style={{ fontSize:'11px', color:'var(--teal)', textDecoration:'none' }}>
                View all →
              </Link>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {phaseStatus.map(({ phase, hasCert, allDone, scheduleOk, statusLabel, statusColor, aId, doneCount, total }) => {
                const phasePct = total > 0 ? Math.round((doneCount/total)*100) : 0
                const phaseColors = ['#f59e0b','#00d4ff']
                const col = phaseColors[phase.phase_number - 1] ?? 'var(--cyan)'
                const canStart = allDone && scheduleOk && !hasCert && !!aId

                return (
                  <div key={phase.id} style={{
                    padding:'14px 16px', borderRadius:'10px',
                    background:'rgba(255,255,255,0.025)',
                    border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', gap:'14px',
                  }}>
                    <div style={{
                      width:'40px', height:'40px', borderRadius:'10px', flexShrink:0,
                      background: hasCert ? 'rgba(34,197,94,0.12)' : `rgba(255,255,255,0.06)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'20px',
                    }}>
                      {hasCert ? '🏆' : '🎯'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'4px' }}>
                        Phase {phase.phase_number}: {phase.title}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div className="progress-track" style={{ flex:1 }}>
                          <div className="progress-fill" style={{
                            width:`${phasePct}%`,
                            background: `linear-gradient(90deg,${col},#7c3aed)`,
                          }}/>
                        </div>
                        <span style={{ fontSize:'11px', color:col, fontWeight:600, flexShrink:0 }}>
                          {phasePct}%
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:'12px', color:statusColor, fontWeight:500 }}>{statusLabel}</div>
                      {canStart && (
                        <Link href={`/programs/cloud-launchpad/assessments/${aId}`}
                          className="btn btn-primary"
                          style={{ fontSize:'11px', padding:'5px 12px', marginTop:'6px', display:'inline-flex' }}>
                          Start →
                        </Link>
                      )}
                      {hasCert && (
                        <Link href="/programs/cloud-launchpad/certificate"
                          className="btn btn-ghost"
                          style={{ fontSize:'11px', padding:'5px 12px', marginTop:'6px', display:'inline-flex' }}>
                          View Cert
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {!isPending && (
              <div style={{ marginTop:'14px', padding:'10px 12px',
                background:'rgba(255,255,255,0.025)', borderRadius:'8px',
                fontSize:'12px', color:'var(--muted)' }}>
                Score ≥ 75% in a phase assessment to earn your certificate 🏆
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
