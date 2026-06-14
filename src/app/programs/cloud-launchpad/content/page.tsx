export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

// ── Types ────────────────────────────────────────────────────
interface ModuleRow {
  id: string
  title: string
  module_number: number
  notes_url: string | null
  is_unlocked: boolean
}

interface PhaseRow {
  id: string
  title: string
  phase_number: number
  description: string | null
  modules: ModuleRow[]
}

interface ProgressRow {
  module_id: string
  status: 'not_started' | 'in_progress' | 'completed'
}

// ── Helpers ──────────────────────────────────────────────────
function ModuleItem({
  mod,
  status,
  phaseSlug,
}: {
  mod: ModuleRow
  status: 'not_started' | 'in_progress' | 'completed' | 'locked'
  phaseSlug: string
}) {
  const iconMap = {
    completed:  { cls: 'mod-done',   icon: '✓' },
    in_progress:{ cls: 'mod-active', icon: '▶' },
    not_started:{ cls: 'mod-active', icon: '○' },
    locked:     { cls: 'mod-locked', icon: '🔒' },
  }
  const { cls, icon } = iconMap[status]
  const isLocked = status === 'locked'

  const inner = (
    <div
      className="module-item"
      style={{
        background: status === 'in_progress'
          ? 'rgba(59,91,219,0.07)'
          : status === 'completed'
          ? 'rgba(34,197,94,0.04)'
          : undefined,
        cursor: isLocked ? 'default' : 'pointer',
        opacity: isLocked ? 0.55 : 1,
      }}
    >
      <div className={`mod-icon ${cls}`} style={{ fontSize: '11px' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: status === 'in_progress' ? 500 : 400 }}>
          {mod.module_number}. {mod.title}
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
        {status === 'completed' ? 'Done' : status === 'in_progress' ? 'In progress' : status === 'locked' ? 'Locked' : 'Not started'}
      </div>
    </div>
  )

  if (isLocked) return inner
  return (
    <Link
      href={`/programs/cloud-launchpad/content/${mod.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      {inner}
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default async function ContentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  // Fetch program id first
  const { data: programData } = await admin
    .from('programs').select('id').eq('slug','cloud-launchpad').single()
  const programId = (programData as {id:string}|null)?.id ?? ''

  // Fetch all phases with modules for Cloud LaunchPad
  const { data: phasesRaw } = await admin
    .from('phases')
    .select(`
      id, title, phase_number, description,
      modules (id, title, module_number, notes_url, is_unlocked)
    `)
    .eq('program_id', programId)
    .order('phase_number')

  const phases = (phasesRaw ?? []) as PhaseRow[]

  // Sort modules within each phase
  phases.forEach(p => {
    p.modules = (p.modules ?? []).sort((a, b) => a.module_number - b.module_number)
  })

  // Fetch student's progress
  const { data: progressRaw } = await supabase
    .from('module_progress')
    .select('module_id, status')
    .eq('student_id', user.id)

  const progressMap = new Map<string, 'not_started' | 'in_progress' | 'completed'>(
    (progressRaw as ProgressRow[] ?? []).map(p => [p.module_id, p.status])
  )

  // Check Phase 1 completion (needed to unlock Phase 2)
  const phase1 = phases.find(p => p.phase_number === 1)
  const phase1ModuleIds = phase1?.modules.map(m => m.id) ?? []
  const phase1Completed = phase1ModuleIds.length > 0 &&
    phase1ModuleIds.every(id => progressMap.get(id) === 'completed')

  // Calculate progress per phase
  const getPhaseStats = (phase: PhaseRow) => {
    const mods = phase.modules
    const completed = mods.filter(m => progressMap.get(m.id) === 'completed').length
    const pct = mods.length > 0 ? Math.round((completed / mods.length) * 100) : 0
    return { completed, total: mods.length, pct }
  }

  const phase1Stats = getPhaseStats((phases.find(p => p.phase_number === 1) ?? { id:'',title:'',phase_number:1,description:null,modules:[] }) as PhaseRow)
  const phase2Stats = getPhaseStats((phases.find(p => p.phase_number === 2) ?? { id:'',title:'',phase_number:2,description:null,modules:[] }) as PhaseRow)

  const phaseColors = [
    { top: 'linear-gradient(90deg,#ff6b35,#f59e0b)', fill: '#ff6b35' },
    { top: 'linear-gradient(90deg,var(--teal),var(--blue))', fill: 'var(--teal)' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="Study Content" subtitle="Cloud LaunchPad — 2 phases · 24 modules"/>

        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'16px' }}>
            {phases.map((phase, pi) => {
              const isPhase2 = phase.phase_number === 2
              const locked   = isPhase2 && !phase1Completed
              const stats    = pi === 0 ? phase1Stats : phase2Stats
              const colors   = phaseColors[pi]

              return (
                <div
                  key={phase.id}
                  className="card"
                  style={{
                    padding: 0, overflow: 'hidden', position: 'relative',
                    opacity: locked ? 0.75 : 1,
                  }}
                >
                  {/* Top accent bar */}
                  <div style={{ height: '3px', background: colors.top }}/>

                  <div style={{ padding: '20px' }}>
                    <div style={{
                      fontSize: '10px', color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px',
                    }}>
                      Phase {phase.phase_number}
                    </div>
                    <div style={{
                      fontFamily: 'Syne, sans-serif', fontWeight: 700,
                      fontSize: '16px', marginBottom: '4px',
                    }}>
                      {phase.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
                      {phase.description}
                    </div>

                    {/* Progress */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: '11px', color: 'var(--muted)', marginBottom: '5px',
                      }}>
                        <span>{locked ? 'Unlocks after Phase 1 complete' : `${stats.completed} of ${stats.total} modules complete`}</span>
                        <span style={{ color: locked ? 'var(--muted)' : colors.fill }}>{stats.pct}%</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${locked ? 0 : stats.pct}%`, background: colors.top }}
                        />
                      </div>
                    </div>

                    {/* Module list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {phase.modules.map(mod => {
                        const rawStatus = progressMap.get(mod.id) ?? 'not_started'
                        const status = locked ? 'locked' as const : rawStatus
                        return (
                          <ModuleItem
                            key={mod.id}
                            mod={mod}
                            status={status}
                            phaseSlug="cloud-launchpad"
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* Locked overlay */}
                  {locked && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(7,8,13,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 10, flexDirection: 'column', gap: '8px',
                    }}>
                      <div style={{ fontSize: '32px' }}>🔒</div>
                      <div style={{
                        fontFamily: 'Syne, sans-serif', fontWeight: 700,
                        fontSize: '14px', color: '#fff',
                      }}>Phase 2 Locked</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', maxWidth: '200px' }}>
                        Complete all Phase 1 modules to unlock
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
