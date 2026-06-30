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

// Cycles through a fixed palette rather than indexing a fixed-length
// array — works correctly whether a programme has 1 phase or 12.
const PHASE_PALETTE = [
  { top: 'linear-gradient(90deg,#ff6b35,#f59e0b)', fill: '#ff6b35' },
  { top: 'linear-gradient(90deg,var(--teal),var(--blue))',  fill: 'var(--teal)' },
  { top: 'linear-gradient(90deg,#a78bfa,#7c3aed)',  fill: '#a78bfa' },
  { top: 'linear-gradient(90deg,#22c55e,#16a34a)',  fill: '#22c55e' },
]

// ── Helpers ──────────────────────────────────────────────────
function ModuleItem({
  mod, status, slug,
}: {
  mod: ModuleRow
  status: 'not_started' | 'in_progress' | 'completed' | 'locked'
  slug: string
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
      href={`/programs/${slug}/content/${mod.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      {inner}
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default async function ContentPage({
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

  // Hard access gate — defense in depth (see access-gate.ts)
  requireActiveStudent(profile)

  const admin = createAdminClient()

  // Resolves the programme by slug AND checks this student is actually
  // entitled to it (404s on unknown slug, redirects to the landing page
  // if they haven't paid for THIS specific programme) — this single
  // call replaces what used to be a hardcoded slug + no entitlement
  // check at all.
  const program = await requireProgramAccess(admin, profile, slug)

  // Fetch all phases with modules for this programme — works for any
  // number of phases, not just exactly 2.
  const { data: phasesRaw } = await admin
    .from('phases')
    .select(`
      id, title, phase_number, description,
      modules (id, title, module_number, notes_url, is_unlocked)
    `)
    .eq('program_id', program.id)
    .order('phase_number')

  const phases = (phasesRaw ?? []) as PhaseRow[]
  phases.forEach(p => {
    p.modules = (p.modules ?? []).sort((a, b) => a.module_number - b.module_number)
  })

  // Fetch student's progress across ALL modules (not scoped to this
  // programme — module IDs are globally unique, so this is safe and
  // avoids an extra filter; only this programme's modules are rendered).
  const { data: progressRaw } = await supabase
    .from('module_progress')
    .select('module_id, status')
    .eq('student_id', user.id)

  const progressMap = new Map<string, 'not_started' | 'in_progress' | 'completed'>(
    (progressRaw as ProgressRow[] ?? []).map(p => [p.module_id, p.status])
  )

  const getPhaseStats = (phase: PhaseRow) => {
    const mods = phase.modules
    const completed = mods.filter(m => progressMap.get(m.id) === 'completed').length
    const pct = mods.length > 0 ? Math.round((completed / mods.length) * 100) : 0
    return { completed, total: mods.length, pct }
  }

  // Generic sequential unlock: phase N is locked until ALL modules in
  // phase N-1 are completed. Phase 1 (or whichever has the lowest
  // phase_number) is always unlocked. Works for any number of phases,
  // unlike the original which only handled exactly phase 1 → phase 2.
  const sortedPhases = [...phases].sort((a, b) => a.phase_number - b.phase_number)
  const phaseLockMap = new Map<string, boolean>()
  sortedPhases.forEach((phase, idx) => {
    if (idx === 0) {
      phaseLockMap.set(phase.id, false)
      return
    }
    const prevPhase = sortedPhases[idx - 1]
    const prevModuleIds = prevPhase.modules.map(m => m.id)
    const prevCompleted = prevModuleIds.length > 0 &&
      prevModuleIds.every(id => progressMap.get(id) === 'completed')
    phaseLockMap.set(phase.id, !prevCompleted)
  })

  const totalModules = phases.reduce((sum, p) => sum + p.modules.length, 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title="Study Content"
          subtitle={`${program.name} — ${phases.length} phase${phases.length !== 1 ? 's' : ''} · ${totalModules} module${totalModules !== 1 ? 's' : ''}`}
        />

        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'16px' }}>
            {sortedPhases.map((phase, pi) => {
              const locked  = phaseLockMap.get(phase.id) ?? false
              const stats   = getPhaseStats(phase)
              const colors  = PHASE_PALETTE[pi % PHASE_PALETTE.length]

              return (
                <div
                  key={phase.id}
                  className="card"
                  style={{
                    padding: 0, overflow: 'hidden', position: 'relative',
                    opacity: locked ? 0.75 : 1,
                  }}
                >
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

                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: '11px', color: 'var(--muted)', marginBottom: '5px',
                      }}>
                        <span>{locked ? `Unlocks after Phase ${phase.phase_number - 1} complete` : `${stats.completed} of ${stats.total} modules complete`}</span>
                        <span style={{ color: locked ? 'var(--muted)' : colors.fill }}>{stats.pct}%</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${locked ? 0 : stats.pct}%`, background: colors.top }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {phase.modules.map(mod => {
                        const rawStatus = progressMap.get(mod.id) ?? 'not_started'
                        const status = locked ? 'locked' as const : rawStatus
                        return (
                          <ModuleItem
                            key={mod.id}
                            mod={mod}
                            status={status}
                            slug={slug}
                          />
                        )
                      })}
                    </div>
                  </div>

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
                      }}>Phase {phase.phase_number} Locked</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', maxWidth: '200px' }}>
                        Complete all Phase {phase.phase_number - 1} modules to unlock
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
