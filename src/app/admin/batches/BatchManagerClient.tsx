'use client'

import { useState, useTransition } from 'react'
import { createClient as createSB } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Loader2, Users, Lock, Unlock,
  ChevronDown, ChevronUp, Edit2, Check, Archive,
} from 'lucide-react'

interface Program { id: string; name: string; slug: string }

type BatchStatus = 'upcoming' | 'active' | 'closed' | 'archived'
type BatchType   = 'open' | 'college' | 'corporate' | 'custom'

const STATUS_CFG: Record<BatchStatus, { label: string; color: string; bg: string; dot: string }> = {
  upcoming: { label: 'Upcoming', color: 'var(--amber)', bg: 'rgba(245,158,11,0.12)', dot: '⏳' },
  active:   { label: 'Active',   color: 'var(--green)', bg: 'rgba(34,197,94,0.12)',  dot: '●'  },
  closed:   { label: 'Closed',   color: 'var(--red)',   bg: 'rgba(239,68,68,0.12)',  dot: '■'  },
  archived: { label: 'Archived', color: 'var(--muted)', bg: 'rgba(255,255,255,0.06)',dot: '📦' },
}

const TYPE_CFG: Record<BatchType, { label: string; color: string; note: string }> = {
  open:      { label: 'Open',      color: 'var(--cyan)',  note: 'Publicly visible — anyone can register' },
  college:   { label: 'College',   color: '#a78bfa',      note: 'Hidden — admin assigns students manually' },
  corporate: { label: 'Corporate', color: '#f59e0b',      note: 'Hidden — admin assigns students manually' },
  custom:    { label: 'Custom',    color: '#93c5fd',      note: 'Hidden — admin assigns students manually' },
}

function sb() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const BLANK_FORM = {
  name: '', description: '', program_id: '', batch_type: 'open' as BatchType,
  max_students: '', price_inr: '',
  reg_opens: '', reg_closes: '', starts_at: '', ends_at: '',
}

export default function BatchManagerClient({
  batches, programs, adminId,
}: {
  batches:  Record<string, unknown>[]
  programs: Program[]
  adminId:  string
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [saving,     setSaving]     = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form,       setForm]       = useState(BLANK_FORM)
  const [creating,   setCreating]   = useState(false)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [editForm,   setEditForm]   = useState(BLANK_FORM)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Create batch ──────────────────────────────────────────
  async function createBatch() {
    if (!form.name.trim())       { showToast('Batch name required', 'error'); return }
    if (!form.program_id)        { showToast('Select a programme', 'error');  return }

    setCreating(true)
    try {
      const isHidden = form.batch_type !== 'open'
      const { error } = await sb().from('batches').insert({
        name:                   form.name.trim(),
        description:            form.description.trim() || null,
        program_id:             form.program_id,
        batch_type:             form.batch_type,
        status:                 'upcoming',
        is_visible:             !isHidden,
        max_students:           form.max_students ? Number(form.max_students) : null,
        price_inr:              form.price_inr    ? Number(form.price_inr)    : null,
        registration_opens_at:  form.reg_opens  ? new Date(form.reg_opens).toISOString()  : null,
        registration_closes_at: form.reg_closes ? new Date(form.reg_closes).toISOString() : null,
        starts_at:              form.starts_at  ? new Date(form.starts_at).toISOString()  : null,
        ends_at:                form.ends_at    ? new Date(form.ends_at).toISOString()    : null,
        created_by:             adminId,
      })
      if (error) throw new Error(error.message)
      showToast('✓ Batch created', 'success')
      setForm(BLANK_FORM)
      setShowCreate(false)
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  // ── Update status ─────────────────────────────────────────
  async function setStatus(batchId: string, status: BatchStatus) {
    setSaving(`status-${batchId}`)
    start(async () => {
      const updates: Record<string, unknown> = { status }
      if (status === 'active') updates.registration_opens_at = new Date().toISOString()
      if (status === 'closed') updates.registration_closes_at = new Date().toISOString()
      const { error } = await sb().from('batches').update(updates).eq('id', batchId)
      if (error) showToast(error.message, 'error')
      else { showToast(`✓ Batch ${status}`, 'success'); router.refresh() }
      setSaving(null)
    })
  }

  // ── Toggle visibility ─────────────────────────────────────
  async function toggleVisibility(batchId: string, current: boolean) {
    setSaving(`vis-${batchId}`)
    start(async () => {
      const { error } = await sb().from('batches')
        .update({ is_visible: !current }).eq('id', batchId)
      if (error) showToast(error.message, 'error')
      else { showToast(!current ? '✓ Batch is now public' : 'Batch hidden', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  // ── Save edits ─────────────────────────────────────────────
  async function saveEdit(batchId: string) {
    setSaving(`edit-${batchId}`)
    start(async () => {
      const isHidden = editForm.batch_type !== 'open'
      const { error } = await sb().from('batches').update({
        name:                   editForm.name.trim(),
        description:            editForm.description.trim() || null,
        batch_type:             editForm.batch_type,
        is_visible:             !isHidden,
        max_students:           editForm.max_students ? Number(editForm.max_students) : null,
        price_inr:              editForm.price_inr    ? Number(editForm.price_inr)    : null,
        registration_opens_at:  editForm.reg_opens  ? new Date(editForm.reg_opens).toISOString()  : null,
        registration_closes_at: editForm.reg_closes ? new Date(editForm.reg_closes).toISOString() : null,
        starts_at:              editForm.starts_at  ? new Date(editForm.starts_at).toISOString()  : null,
        ends_at:                editForm.ends_at    ? new Date(editForm.ends_at).toISOString()    : null,
      }).eq('id', batchId)
      if (error) showToast(error.message, 'error')
      else { showToast('✓ Batch updated', 'success'); setEditId(null); router.refresh() }
      setSaving(null)
    })
  }

  function startEdit(b: Record<string, unknown>) {
    setEditId(b.id as string)
    setEditForm({
      name:        String(b.name ?? ''),
      description: String(b.description ?? ''),
      program_id:  String(b.program_id ?? ''),
      batch_type:  (b.batch_type as BatchType) ?? 'open',
      max_students: b.max_students ? String(b.max_students) : '',
      price_inr:    b.price_inr    ? String(b.price_inr)    : '',
      reg_opens:   b.registration_opens_at  ? String(b.registration_opens_at).slice(0,16)  : '',
      reg_closes:  b.registration_closes_at ? String(b.registration_closes_at).slice(0,16) : '',
      starts_at:   b.starts_at ? String(b.starts_at).slice(0,16) : '',
      ends_at:     b.ends_at   ? String(b.ends_at).slice(0,16)   : '',
    })
  }

  // ── Form section renderer ─────────────────────────────────
  function FormFields({
    f, set,
  }: {
    f: typeof BLANK_FORM
    set: (u: Partial<typeof BLANK_FORM>) => void
  }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
          <div>
            <label className="form-label">Batch Name *</label>
            <input className="form-input" placeholder="e.g. Cloud LaunchPad — Jan 2026"
              value={f.name} onChange={e => set({ name: e.target.value })}/>
          </div>
          <div>
            <label className="form-label">Type *</label>
            <select className="form-select" value={f.batch_type}
              onChange={e => set({ batch_type: e.target.value as BatchType })}>
              <option value="open">Open (public)</option>
              <option value="college">College (hidden)</option>
              <option value="corporate">Corporate (hidden)</option>
              <option value="custom">Custom (hidden)</option>
            </select>
          </div>
        </div>

        {/* Type explanation */}
        <div className="banner banner-info" style={{ margin: 0 }}>
          <span style={{ flexShrink: 0 }}>ℹ️</span>
          <span style={{ fontSize: '12px' }}>
            <strong style={{ color: '#fff' }}>{TYPE_CFG[f.batch_type].label}:</strong>{' '}
            {TYPE_CFG[f.batch_type].note}
          </span>
        </div>

        <div>
          <label className="form-label">Programme *</label>
          <select className="form-select" value={f.program_id}
            onChange={e => set({ program_id: e.target.value })}>
            <option value="">Select programme…</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={2}
            placeholder="Brief description of this batch…"
            value={f.description}
            onChange={e => set({ description: e.target.value })}
            style={{ resize: 'vertical' }}/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
          <div>
            <label className="form-label">Max Students (blank = unlimited)</label>
            <input className="form-input" type="number" placeholder="e.g. 50"
              value={f.max_students} onChange={e => set({ max_students: e.target.value })}/>
          </div>
          <div>
            <label className="form-label">Price (₹, blank = contact)</label>
            <input className="form-input" type="number" placeholder="e.g. 5999"
              value={f.price_inr} onChange={e => set({ price_inr: e.target.value })}/>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
          <div>
            <label className="form-label">Registration Opens</label>
            <input className="form-input" type="datetime-local"
              value={f.reg_opens} onChange={e => set({ reg_opens: e.target.value })}/>
          </div>
          <div>
            <label className="form-label">Registration Closes</label>
            <input className="form-input" type="datetime-local"
              value={f.reg_closes} onChange={e => set({ reg_closes: e.target.value })}/>
          </div>
          <div>
            <label className="form-label">Batch Starts</label>
            <input className="form-input" type="datetime-local"
              value={f.starts_at} onChange={e => set({ starts_at: e.target.value })}/>
          </div>
          <div>
            <label className="form-label">Batch Ends</label>
            <input className="form-input" type="datetime-local"
              value={f.ends_at} onChange={e => set({ ends_at: e.target.value })}/>
          </div>
        </div>
      </div>
    )
  }

  const fmtDate = (d: unknown) => d
    ? new Date(d as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    : '—'

  return (
    <div>
      {/* Create button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}
          style={{ fontSize: '13px' }}>
          {showCreate ? <><X size={14}/> Cancel</> : <><Plus size={14}/> Create New Batch</>}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '20px', padding: '24px',
          border: '1px solid rgba(0,200,248,0.2)' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: '16px', marginBottom: '18px' }}>
            New Batch
          </div>
          <FormFields f={form} set={u => setForm(p => ({ ...p, ...u }))}/>
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button className="btn btn-primary" onClick={createBatch}
              disabled={creating} style={{ fontSize: '13px', padding: '10px 22px' }}>
              {creating
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> Creating…</>
                : <><Check size={13}/> Create Batch</>}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}
              style={{ fontSize: '13px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Batches list */}
      {batches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
          <div style={{ fontSize: '14px' }}>No batches yet. Create your first batch above.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {batches.map(b => {
            const bid     = b.id as string
            const status  = b.status as BatchStatus
            const btype   = b.batch_type as BatchType
            const stCfg   = STATUS_CFG[status]
            const tyCfg   = TYPE_CFG[btype]
            const isExpanded = expandedId === bid
            const isEditing  = editId === bid
            const program    = b.programs as Record<string, unknown> | null
            const stBusy  = saving === `status-${bid}` && isPending
            const visBusy = saving === `vis-${bid}`    && isPending
            const edBusy  = saving === `edit-${bid}`   && isPending

            return (
              <div key={bid} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                  padding: '16px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                }} onClick={() => setExpandedId(isExpanded ? null : bid)}>

                  {/* Status dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: stCfg.color,
                    boxShadow: status === 'active' ? `0 0 8px ${stCfg.color}` : 'none',
                  }}/>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px' }}>
                        {String(b.name ?? '')}
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                        background: `${tyCfg.color}18`, color: tyCfg.color,
                      }}>
                        {tyCfg.label}
                      </span>
                      {!b.is_visible && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                          background: 'rgba(255,255,255,0.06)', color: 'var(--muted)',
                        }}>
                          🔒 Hidden
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {String(program?.name ?? '')}
                      {' · '}{b.student_count as number} student{b.student_count !== 1 ? 's' : ''}
                      {b.max_students ? ` / ${b.max_students} max` : ''}
                      {b.starts_at ? ` · Starts ${fmtDate(b.starts_at)}` : ''}
                    </div>
                  </div>

                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                    background: stCfg.bg, color: stCfg.color, flexShrink: 0,
                  }}>
                    {stCfg.dot} {stCfg.label}
                  </span>

                  {/* Quick actions */}
                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    {status === 'upcoming' && (
                      <button className="btn btn-success"
                        style={{ fontSize: '11px', padding: '5px 12px' }}
                        onClick={() => setStatus(bid, 'active')}
                        disabled={stBusy}>
                        {stBusy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/> : '▶ Open'}
                      </button>
                    )}
                    {status === 'active' && (
                      <button className="btn btn-danger"
                        style={{ fontSize: '11px', padding: '5px 12px' }}
                        onClick={() => setStatus(bid, 'closed')}
                        disabled={stBusy}>
                        {stBusy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/> : '■ Close'}
                      </button>
                    )}
                    {status === 'closed' && (
                      <button className="btn btn-ghost"
                        style={{ fontSize: '11px', padding: '5px 12px' }}
                        onClick={() => setStatus(bid, 'archived')}
                        disabled={stBusy}>
                        <Archive size={11}/> Archive
                      </button>
                    )}
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '5px 10px' }}
                      onClick={() => toggleVisibility(bid, b.is_visible as boolean)}
                      disabled={visBusy}
                      title={b.is_visible ? 'Make hidden' : 'Make visible'}>
                      {visBusy
                        ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                        : b.is_visible ? <Lock size={11}/> : <Unlock size={11}/>}
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '5px 10px' }}
                      onClick={() => { startEdit(b); setExpandedId(bid) }}>
                      <Edit2 size={11}/>
                    </button>
                  </div>

                  {isExpanded
                    ? <ChevronUp size={16} style={{ color: 'var(--muted)', flexShrink: 0 }}/>
                    : <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }}/>}
                </div>

                {/* Expanded: edit form OR info */}
                {isExpanded && (
                  <div style={{ padding: '20px' }}>
                    {isEditing ? (
                      <>
                        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700,
                          fontSize: '13px', marginBottom: '14px', color: 'var(--teal)' }}>
                          Editing: {String(b.name ?? '')}
                        </div>
                        <FormFields
                          f={editForm}
                          set={u => setEditForm(p => ({ ...p, ...u }))}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                          <button className="btn btn-primary" onClick={() => saveEdit(bid)}
                            disabled={edBusy} style={{ fontSize: '13px' }}>
                            {edBusy
                              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> Saving…</>
                              : <><Check size={13}/> Save Changes</>}
                          </button>
                          <button className="btn btn-ghost"
                            onClick={() => setEditId(null)} style={{ fontSize: '13px' }}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                        {[
                          { label: 'Type',          value: tyCfg.label },
                          { label: 'Visibility',    value: b.is_visible ? '🌐 Public' : '🔒 Hidden' },
                          { label: 'Max Students',  value: b.max_students ? String(b.max_students) : 'Unlimited' },
                          { label: 'Price',         value: b.price_inr ? `₹${Number(b.price_inr).toLocaleString('en-IN')}` : 'Not set' },
                          { label: 'Reg Opens',     value: fmtDate(b.registration_opens_at) },
                          { label: 'Reg Closes',    value: fmtDate(b.registration_closes_at) },
                          { label: 'Starts',        value: fmtDate(b.starts_at) },
                          { label: 'Ends',          value: fmtDate(b.ends_at) },
                          { label: 'Students',      value: String(b.student_count as number) },
                        ].map(({ label, value }) => (
                          <div key={label} style={{
                            padding: '10px 14px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontSize: '10px', color: 'var(--muted)',
                              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 500 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assign students to batch (for hidden/private batches) */}
                    {!b.is_visible && !isEditing && (
                      <div className="banner banner-info" style={{ marginTop: '14px' }}>
                        <span>👥</span>
                        <span style={{ fontSize: '13px' }}>
                          This is a hidden batch. Assign students from the{' '}
                          <a href="/admin/access" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
                            Access Management
                          </a>
                          {' '}page — grant access and set their batch when activating.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
