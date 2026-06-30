'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Loader2, Edit2, Check, X,
  ChevronUp, ChevronDown, GripVertical, Lock, Unlock,
} from 'lucide-react'

interface Module {
  id: string; title: string; module_number: number
  notes_url: string | null; is_unlocked: boolean
}
interface Phase {
  id: string; title: string; phase_number: number
  description: string | null; modules: Module[]
}

// All writes go through the API route to bypass RLS
async function apiWrite(action: string, body: Record<string, unknown>) {
  const res = await fetch('/api/curriculum', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, ...body }),
  })
  const json = await res.json() as { error?: string }
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json
}

export default function CurriculumEditorClient({
  phases, programId,
}: {
  phases:    Phase[]
  programId: string
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [toast,   setToast]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [saving,  setSaving]  = useState<string | null>(null)

  // Phase editing state
  const [editPhaseId,   setEditPhaseId]   = useState<string | null>(null)
  const [phaseTitle,    setPhaseTitle]    = useState('')
  const [phaseDesc,     setPhaseDesc]     = useState('')
  const [newPhaseTitle, setNewPhaseTitle] = useState('')
  const [addingPhase,   setAddingPhase]   = useState(false)

  // Module editing state
  const [editModId,   setEditModId]   = useState<string | null>(null)
  const [modTitle,    setModTitle]    = useState('')
  const [addingToPhase, setAddingToPhase] = useState<string | null>(null)
  const [newModTitle,   setNewModTitle]   = useState('')

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Phase operations ──────────────────────────────────────

  async function savePhaseEdit(phaseId: string) {
    if (!phaseTitle.trim()) { showToast('Title required', 'error'); return }
    setSaving(`phase-${phaseId}`)
    start(async () => {
      try {
        await apiWrite('update_phase', {
          phaseId, title: phaseTitle.trim(), description: phaseDesc.trim() || null,
        })
        showToast('✓ Phase updated', 'success')
        setEditPhaseId(null)
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  async function addPhase() {
    if (!newPhaseTitle.trim()) { showToast('Phase title required', 'error'); return }
    setSaving('new-phase')
    start(async () => {
      try {
        const nextNum = phases.length + 1
        await apiWrite('create_phase', {
          programId, title: newPhaseTitle.trim(), phase_number: nextNum,
        })
        showToast('✓ Phase added', 'success')
        setNewPhaseTitle('')
        setAddingPhase(false)
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  async function deletePhase(phaseId: string, title: string, moduleCount: number) {
    if (moduleCount > 0) {
      showToast(`Remove all ${moduleCount} modules from "${title}" first before deleting the phase`, 'error')
      return
    }
    if (!confirm(`Delete phase "${title}"? This cannot be undone.`)) return
    setSaving(`del-phase-${phaseId}`)
    start(async () => {
      try {
        await apiWrite('delete_phase', { phaseId })
        showToast('Phase deleted', 'success')
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  // ── Module operations ─────────────────────────────────────

  async function saveModuleEdit(moduleId: string) {
    if (!modTitle.trim()) { showToast('Title required', 'error'); return }
    setSaving(`mod-${moduleId}`)
    start(async () => {
      try {
        await apiWrite('update_module', { moduleId, title: modTitle.trim() })
        showToast('✓ Module updated', 'success')
        setEditModId(null)
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  async function addModule(phaseId: string, currentCount: number) {
    if (!newModTitle.trim()) { showToast('Module title required', 'error'); return }
    setSaving(`new-mod-${phaseId}`)
    start(async () => {
      try {
        await apiWrite('create_module', {
          phaseId, title: newModTitle.trim(), module_number: currentCount + 1,
        })
        showToast('✓ Module added', 'success')
        setNewModTitle('')
        setAddingToPhase(null)
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  async function deleteModule(moduleId: string, title: string) {
    if (!confirm(`Delete module "${title}"? Student progress for this module will also be removed.`)) return
    setSaving(`del-mod-${moduleId}`)
    start(async () => {
      try {
        await apiWrite('delete_module', { moduleId })
        showToast('Module deleted', 'success')
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  async function toggleModuleUnlock(moduleId: string, current: boolean) {
    setSaving(`unlock-${moduleId}`)
    start(async () => {
      try {
        await apiWrite('toggle_module_unlock', { moduleId, isUnlocked: !current })
        showToast(!current ? '✓ Module unlocked' : 'Module locked', 'success')
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  async function moveModule(moduleId: string, phaseId: string, direction: 'up' | 'down', modules: Module[]) {
    const idx     = modules.findIndex(m => m.id === moduleId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= modules.length) return

    const a = modules[idx]
    const bMod = modules[swapIdx]

    setSaving(`move-${moduleId}`)
    start(async () => {
      try {
        await apiWrite('swap_module_order', {
          moduleId1: a.id, order1: bMod.module_number,
          moduleId2: bMod.id, order2: a.module_number,
        })
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  return (
    <div>
      {/* Phases */}
      {phases.map(phase => (
        <div key={phase.id} className="card" style={{ marginBottom: '20px', padding: 0, overflow: 'hidden' }}>

          {/* Phase header */}
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'flex-start', gap: '14px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '6px',
              background: phase.phase_number === 1 ? '#f59e0b' : 'var(--cyan)',
            }}/>

            <div style={{ flex: 1 }}>
              {editPhaseId === phase.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label className="form-label">Phase Title</label>
                    <input className="form-input" value={phaseTitle}
                      onChange={e => setPhaseTitle(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Description (optional)</label>
                    <input className="form-input" value={phaseDesc}
                      onChange={e => setPhaseDesc(e.target.value)}
                      placeholder="Brief description of this phase…"/>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" style={{ fontSize: '12px', padding: '7px 16px' }}
                      onClick={() => savePhaseEdit(phase.id)}
                      disabled={saving === `phase-${phase.id}` && isPending}>
                      {saving === `phase-${phase.id}` && isPending
                        ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/>
                        : <><Check size={12}/> Save</>}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: '12px' }}
                      onClick={() => setEditPhaseId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontFamily: 'Space Mono,monospace', fontSize: '10px',
                      color: phase.phase_number === 1 ? '#f59e0b' : 'var(--cyan)',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      Phase {phase.phase_number}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700,
                    fontSize: '16px', color: '#fff', marginTop: '2px' }}>
                    {phase.title}
                  </div>
                  {phase.description && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                      {phase.description}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                    {phase.modules.length} module{phase.modules.length !== 1 ? 's' : ''}
                    {' · '}
                    {phase.modules.filter(m => m.notes_url).length} with notes
                  </div>
                </>
              )}
            </div>

            {editPhaseId !== phase.id && (
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 10px' }}
                  onClick={() => {
                    setEditPhaseId(phase.id)
                    setPhaseTitle(phase.title)
                    setPhaseDesc(phase.description ?? '')
                  }}>
                  <Edit2 size={12}/> Edit
                </button>
                <button className="btn btn-danger" style={{ fontSize: '11px', padding: '5px 10px' }}
                  onClick={() => deletePhase(phase.id, phase.title, phase.modules.length)}
                  disabled={saving === `del-phase-${phase.id}` && isPending}>
                  {saving === `del-phase-${phase.id}` && isPending
                    ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                    : <Trash2 size={11}/>}
                </button>
              </div>
            )}
          </div>

          {/* Modules list */}
          <div style={{ padding: '16px 22px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {phase.modules.map((mod, i) => (
                <div key={mod.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid ${mod.is_unlocked ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                }}>
                  {/* Grip / reorder */}
                  <GripVertical size={14} style={{ color: 'var(--muted)', flexShrink: 0 }}/>

                  {/* Module number */}
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                    background: mod.is_unlocked ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '10px',
                    color: mod.is_unlocked ? 'var(--green)' : 'var(--muted)',
                  }}>
                    {mod.module_number}
                  </div>

                  {/* Title (editable or read) */}
                  {editModId === mod.id ? (
                    <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input className="form-input" value={modTitle}
                        onChange={e => setModTitle(e.target.value)}
                        style={{ flex: 1 }} autoFocus/>
                      <button className="btn btn-primary" style={{ fontSize: '11px', padding: '5px 12px', flexShrink: 0 }}
                        onClick={() => saveModuleEdit(mod.id)}
                        disabled={saving === `mod-${mod.id}` && isPending}>
                        {saving === `mod-${mod.id}` && isPending
                          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                          : <><Check size={11}/> Save</>}
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 10px', flexShrink: 0 }}
                        onClick={() => setEditModId(null)}>
                        <X size={11}/>
                      </button>
                    </div>
                  ) : (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{mod.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                        {mod.notes_url
                          ? <span style={{ color: 'var(--green)' }}>📄 Notes uploaded</span>
                          : <span>No notes</span>}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {editModId !== mod.id && (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {/* Move up/down */}
                      <button className="btn btn-ghost" style={{ padding: '4px 6px', fontSize: '10px' }}
                        onClick={() => moveModule(mod.id, phase.id, 'up', phase.modules)}
                        disabled={i === 0 || (saving === `move-${mod.id}` && isPending)}>
                        <ChevronUp size={12}/>
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '4px 6px', fontSize: '10px' }}
                        onClick={() => moveModule(mod.id, phase.id, 'down', phase.modules)}
                        disabled={i === phase.modules.length - 1 || (saving === `move-${mod.id}` && isPending)}>
                        <ChevronDown size={12}/>
                      </button>

                      {/* Lock/Unlock */}
                      <button
                        className={mod.is_unlocked ? 'btn btn-ghost' : 'btn btn-success'}
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        onClick={() => toggleModuleUnlock(mod.id, mod.is_unlocked)}
                        disabled={saving === `unlock-${mod.id}` && isPending}
                        title={mod.is_unlocked ? 'Lock module' : 'Unlock module'}>
                        {saving === `unlock-${mod.id}` && isPending
                          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                          : mod.is_unlocked ? <Lock size={11}/> : <Unlock size={11}/>}
                      </button>

                      {/* Edit */}
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '10px' }}
                        onClick={() => { setEditModId(mod.id); setModTitle(mod.title) }}>
                        <Edit2 size={11}/>
                      </button>

                      {/* Delete */}
                      <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '10px' }}
                        onClick={() => deleteModule(mod.id, mod.title)}
                        disabled={saving === `del-mod-${mod.id}` && isPending}>
                        {saving === `del-mod-${mod.id}` && isPending
                          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                          : <Trash2 size={11}/>}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add module */}
            {addingToPhase === phase.id ? (
              <div style={{
                display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px',
                padding: '12px 14px', borderRadius: '8px',
                background: 'rgba(0,200,248,0.04)', border: '1px dashed rgba(0,200,248,0.3)',
              }}>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '11px',
                  color: 'var(--muted)', flexShrink: 0 }}>
                  {phase.modules.length + 1}.
                </div>
                <input className="form-input" placeholder="New module title…" autoFocus
                  value={newModTitle} onChange={e => setNewModTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addModule(phase.id, phase.modules.length) }}
                  style={{ flex: 1 }}/>
                <button className="btn btn-primary" style={{ fontSize: '12px', padding: '7px 14px', flexShrink: 0 }}
                  onClick={() => addModule(phase.id, phase.modules.length)}
                  disabled={saving === `new-mod-${phase.id}` && isPending}>
                  {saving === `new-mod-${phase.id}` && isPending
                    ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/>
                    : <><Check size={12}/> Add</>}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '7px 10px', flexShrink: 0 }}
                  onClick={() => { setAddingToPhase(null); setNewModTitle('') }}>
                  <X size={12}/>
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost"
                onClick={() => { setAddingToPhase(phase.id); setNewModTitle('') }}
                style={{ fontSize: '12px', marginTop: '10px', width: '100%',
                  justifyContent: 'center', borderStyle: 'dashed' }}>
                <Plus size={13}/> Add Module to Phase {phase.phase_number}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add new phase */}
      {addingPhase ? (
        <div className="card" style={{
          padding: '20px', border: '1px dashed rgba(0,200,248,0.3)',
          background: 'rgba(0,200,248,0.03)',
        }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>
            New Phase — Phase {phases.length + 1}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input className="form-input" placeholder="Phase title (e.g. AWS DevOps)"
              value={newPhaseTitle} onChange={e => setNewPhaseTitle(e.target.value)}
              style={{ flex: 1 }} autoFocus/>
            <button className="btn btn-primary" style={{ fontSize: '13px', flexShrink: 0 }}
              onClick={addPhase}
              disabled={saving === 'new-phase' && isPending}>
              {saving === 'new-phase' && isPending
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/>
                : <><Check size={13}/> Add Phase</>}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: '13px', flexShrink: 0 }}
              onClick={() => { setAddingPhase(false); setNewPhaseTitle('') }}>
              <X size={13}/>
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost"
          onClick={() => setAddingPhase(true)}
          style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed', fontSize: '13px' }}>
          <Plus size={14}/> Add New Phase
        </button>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
