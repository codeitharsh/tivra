'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, CheckCircle2, Eye, Trash2 } from 'lucide-react'

interface ProgramRow {
  id: string; name: string; slug: string
  price_inr: number | null; duration_label: string | null
  is_active: boolean; curriculum_url: string | null
  mode: string; placement_assistance: boolean
}

interface EditState {
  price_inr: string; duration_label: string; mode: string
}

export default function ProgramsManagerClient({ programs }: { programs: ProgramRow[] }) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>(
    Object.fromEntries(programs.map(p => [p.id, {
      price_inr: p.price_inr != null ? String(p.price_inr) : '',
      duration_label: p.duration_label ?? '',
      mode: p.mode,
    }]))
  )
  const [saving,     setSaving]     = useState<string | null>(null)
  const [uploading,  setUploading]  = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function setEdit(id: string, patch: Partial<EditState>) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function patchProgram(id: string, body: Record<string, unknown>, successMsg: string) {
    setSaving(id)
    try {
      const res = await fetch(`/api/admin/programs/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Could not save')
      showToast(successMsg, 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setSaving(null)
    }
  }

  function saveProgram(id: string) {
    const edit = edits[id]
    void patchProgram(id, {
      price_inr: edit.price_inr ? Number(edit.price_inr) : 0,
      duration_label: edit.duration_label,
      mode: edit.mode,
    }, '✓ Saved')
  }

  function toggleActive(id: string, isActive: boolean) {
    void patchProgram(id, { is_active: isActive }, isActive ? '✓ Programme activated' : '✓ Programme deactivated')
  }

  function togglePlacement(id: string, value: boolean) {
    void patchProgram(id, { placement_assistance: value }, value ? '✓ Placement assistance enabled' : '✓ Placement assistance disabled')
  }

  async function uploadCurriculum(programId: string, file: File) {
    if (!file.name.endsWith('.pdf')) { showToast('Only PDF files are allowed', 'error'); return }
    if (file.size > 50 * 1024 * 1024) { showToast('File too large (max 50MB)', 'error'); return }

    setUploading(programId)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('program_id', programId)
      const res = await fetch('/api/admin/upload-curriculum', { method: 'POST', body: form })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Upload failed')
      showToast('✓ Curriculum uploaded', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(null)
    }
  }

  async function previewCurriculum(programId: string) {
    setPreviewing(programId)
    try {
      const res = await fetch(`/api/admin/curriculum-preview/${programId}`)
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not open preview')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Preview failed', 'error')
    } finally {
      setPreviewing(null)
    }
  }

  async function deleteCurriculum(programId: string, programName: string) {
    if (!window.confirm(`Delete the curriculum PDF for ${programName}? This can't be undone — you'll need to re-upload it.`)) return

    setDeleting(programId)
    try {
      const res = await fetch('/api/admin/delete-curriculum', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Delete failed')
      showToast('✓ Curriculum deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {programs.map(p => {
        const edit = edits[p.id]
        return (
          <div key={p.id} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '16px', color: '#fff' }}>{p.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>/programs/{p.slug}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={p.placement_assistance} disabled={saving === p.id}
                    onChange={e => togglePlacement(p.id, e.target.checked)}
                  />
                  Placement assistance
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={p.is_active} disabled={saving === p.id}
                    onChange={e => toggleActive(p.id, e.target.checked)}
                  />
                  Active (visible on site)
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end', marginBottom: '16px' }} className="r-grid-2">
              <div>
                <label className="form-label">Price (₹)</label>
                <input className="form-input" type="number" min="0"
                  value={edit.price_inr}
                  onChange={e => setEdit(p.id, { price_inr: e.target.value })}/>
              </div>
              <div>
                <label className="form-label">Duration</label>
                <input className="form-input" placeholder="e.g. 6 Months"
                  value={edit.duration_label}
                  onChange={e => setEdit(p.id, { duration_label: e.target.value })}/>
              </div>
              <div>
                <label className="form-label">Mode</label>
                <input className="form-input" placeholder="e.g. Live Online"
                  value={edit.mode}
                  onChange={e => setEdit(p.id, { mode: e.target.value })}/>
              </div>
              <button className="btn btn-primary" disabled={saving === p.id}
                onClick={() => saveProgram(p.id)} style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                {saving === p.id ? <Loader2 size={14} className="spin"/> : 'Save'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: p.curriculum_url ? 'var(--green)' : 'var(--muted)' }}>
                {p.curriculum_url ? <CheckCircle2 size={14}/> : <Upload size={14}/>}
                {p.curriculum_url ? 'Curriculum PDF uploaded' : 'No curriculum PDF yet'}
              </div>
              <input
                ref={el => { fileInputs.current[p.id] = el }}
                type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadCurriculum(p.id, f); e.target.value = '' }}
              />
              <button className="btn btn-ghost" style={{ fontSize: '12px' }}
                disabled={uploading === p.id}
                onClick={() => fileInputs.current[p.id]?.click()}>
                {uploading === p.id ? <Loader2 size={13} className="spin"/> : (p.curriculum_url ? 'Replace PDF' : 'Upload PDF')}
              </button>
              {p.curriculum_url && (
                <>
                  <button className="btn btn-ghost" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    disabled={previewing === p.id}
                    onClick={() => previewCurriculum(p.id)}>
                    {previewing === p.id ? <Loader2 size={13} className="spin"/> : <Eye size={13}/>} Preview
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)' }}
                    disabled={deleting === p.id}
                    onClick={() => deleteCurriculum(p.id, p.name)}>
                    {deleting === p.id ? <Loader2 size={13} className="spin"/> : <Trash2 size={13}/>} Delete
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
