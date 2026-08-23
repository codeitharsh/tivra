'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Upload, CheckCircle2, Trash2, Plus, X, Check,
  ChevronDown, ChevronUp,
} from 'lucide-react'

interface Subject {
  id: string; name: string; slug: string; description: string | null
  is_active: boolean; display_order: number
}
interface Note {
  id: string; subject_id: string; title: string; note_number: number; notes_url: string | null
}

const BLANK_SUBJECT = { name: '', description: '' }
const BLANK_NOTE     = { title: '', note_number: '' }

export default function FreeNotesManagerClient({ subjects, notes }: { subjects: Subject[]; notes: Note[] }) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const [showCreateSubject, setShowCreateSubject] = useState(false)
  const [subjectForm, setSubjectForm] = useState(BLANK_SUBJECT)
  const [creatingSubject, setCreatingSubject] = useState(false)

  const [noteForms, setNoteForms] = useState<Record<string, typeof BLANK_NOTE>>({})

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function callApi(body: Record<string, unknown>) {
    const res = await fetch('/api/free-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json() as { error?: string; [k: string]: unknown }
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json
  }

  async function createSubject() {
    if (!subjectForm.name.trim()) { showToast('Subject name is required', 'error'); return }
    setCreatingSubject(true)
    try {
      await callApi({ action: 'create_subject', name: subjectForm.name.trim(), description: subjectForm.description.trim() || undefined })
      showToast('✓ Subject created', 'success')
      setSubjectForm(BLANK_SUBJECT)
      setShowCreateSubject(false)
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setCreatingSubject(false)
    }
  }

  async function toggleSubjectActive(subjectId: string, isActive: boolean) {
    setBusy(`toggle-${subjectId}`)
    try {
      await callApi({ action: 'update_subject', subjectId, isActive })
      showToast(isActive ? '✓ Subject activated' : '✓ Subject deactivated', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteSubject(subjectId: string, name: string) {
    if (!window.confirm(`Delete "${name}" and all of its notes? This can't be undone.`)) return
    setBusy(`del-subject-${subjectId}`)
    try {
      await callApi({ action: 'delete_subject', subjectId })
      showToast('✓ Subject deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function createNote(subjectId: string) {
    const form = noteForms[subjectId] ?? BLANK_NOTE
    if (!form.title.trim())    { showToast('Note title is required', 'error'); return }
    if (!form.note_number)     { showToast('Note number is required', 'error'); return }
    setBusy(`add-note-${subjectId}`)
    try {
      await callApi({
        action: 'create_note', subjectId,
        title: form.title.trim(), noteNumber: Number(form.note_number),
      })
      showToast('✓ Note added — now upload its PDF', 'success')
      setNoteForms(p => ({ ...p, [subjectId]: BLANK_NOTE }))
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteNote(noteId: string) {
    if (!window.confirm('Delete this note?')) return
    setBusy(`del-note-${noteId}`)
    try {
      await callApi({ action: 'delete_note', noteId })
      showToast('✓ Note deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function uploadNotePdf(subjectId: string, noteId: string, file: File) {
    if (!file.name.endsWith('.pdf')) { showToast('Only PDF files are allowed', 'error'); return }
    if (file.size > 50 * 1024 * 1024) { showToast('File too large (max 50MB)', 'error'); return }

    setBusy(`upload-${noteId}`)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('note_id', noteId)
      form.append('subject_id', subjectId)
      const res = await fetch('/api/upload-free-note', { method: 'POST', body: form })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Upload failed')
      showToast('✓ PDF uploaded', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setShowCreateSubject(v => !v)} style={{ fontSize: '13px' }}>
          {showCreateSubject ? <><X size={14}/> Cancel</> : <><Plus size={14}/> New subject</>}
        </button>
      </div>

      {showCreateSubject && (
        <div className="card" style={{ padding: '24px', border: '1px solid var(--accent-ring)' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', marginBottom: '18px' }}>
            New subject
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Name *</label>
              <input className="form-input" placeholder="e.g. Operating Systems"
                value={subjectForm.name}
                onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={2} placeholder="Shown on the subject card…"
                value={subjectForm.description}
                onChange={e => setSubjectForm(f => ({ ...f, description: e.target.value }))}
                style={{ resize: 'vertical' }}/>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={createSubject} disabled={creatingSubject}
                style={{ fontSize: '13px', padding: '10px 22px' }}>
                {creatingSubject ? <><Loader2 size={14} className="spin"/> Creating…</> : <><Check size={14}/> Create subject</>}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowCreateSubject(false); setSubjectForm(BLANK_SUBJECT) }} style={{ fontSize: '13px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {subjects.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          No subjects yet. Create one above.
        </div>
      )}

      {subjects.map(s => {
        const subjectNotes = notes.filter(n => n.subject_id === s.id).sort((a, b) => a.note_number - b.note_number)
        const isOpen = expandedId === s.id
        const noteForm = noteForms[s.id] ?? BLANK_NOTE

        return (
          <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '14px',
                borderBottom: isOpen ? '1px solid var(--border)' : 'none',
              }}
              onClick={() => setExpandedId(isOpen ? null : s.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px' }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  /free-notes/{s.slug} · {subjectNotes.length} note{subjectNotes.length !== 1 ? 's' : ''}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={s.is_active} disabled={busy === `toggle-${s.id}`}
                  onChange={e => toggleSubjectActive(s.id, e.target.checked)}/>
                Active
              </label>
              <button className="btn btn-danger" onClick={e => { e.stopPropagation(); deleteSubject(s.id, s.name) }}
                disabled={busy === `del-subject-${s.id}`} style={{ fontSize: '11px', padding: '5px 10px' }}>
                {busy === `del-subject-${s.id}` ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
              </button>
              {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }}/> : <ChevronDown size={16} style={{ color: 'var(--muted)' }}/>}
            </div>

            {isOpen && (
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  {subjectNotes.length === 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0' }}>No notes yet — add one below.</div>
                  )}
                  {subjectNotes.map(n => (
                    <div key={n.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                      padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--card2)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', color: 'var(--muted)' }}>#{n.note_number}</span>
                        <span style={{ fontSize: '13px' }}>{n.title}</span>
                        {n.notes_url && <CheckCircle2 size={13} color="var(--green)"/>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <input
                          ref={el => { fileInputs.current[n.id] = el }}
                          type="file" accept=".pdf" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadNotePdf(s.id, n.id, f); e.target.value = '' }}
                        />
                        <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 10px' }}
                          disabled={busy === `upload-${n.id}`}
                          onClick={() => fileInputs.current[n.id]?.click()}>
                          {busy === `upload-${n.id}` ? <Loader2 size={11} className="spin"/> : (n.notes_url ? 'Replace PDF' : <><Upload size={11}/> Upload PDF</>)}
                        </button>
                        <button className="btn btn-danger" style={{ fontSize: '11px', padding: '5px 10px' }}
                          disabled={busy === `del-note-${n.id}`}
                          onClick={() => deleteNote(n.id)}>
                          {busy === `del-note-${n.id}` ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ width: '90px' }}>
                    <label className="form-label">No.</label>
                    <input className="form-input" type="number" min="1" placeholder="1"
                      value={noteForm.note_number}
                      onChange={e => setNoteForms(p => ({ ...p, [s.id]: { ...noteForm, note_number: e.target.value } }))}/>
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label">Note title</label>
                    <input className="form-input" placeholder="e.g. Arrays & Strings"
                      value={noteForm.title}
                      onChange={e => setNoteForms(p => ({ ...p, [s.id]: { ...noteForm, title: e.target.value } }))}/>
                  </div>
                  <button className="btn btn-primary" onClick={() => createNote(s.id)}
                    disabled={busy === `add-note-${s.id}`} style={{ fontSize: '12px', padding: '9px 18px' }}>
                    {busy === `add-note-${s.id}`
                      ? <Loader2 size={13} className="spin"/>
                      : <><Plus size={13}/> Add note</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  )
}
