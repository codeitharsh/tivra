'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Plus, X, Check, Trash2, ChevronDown, ChevronUp, Layers, ArrowRight, Users,
} from 'lucide-react'

interface Course {
  id: string; slug: string; title: string; description: string | null
  difficulty: string; estimated_duration_minutes: number | null
  skills: string[]; learning_outcomes: string[]
  status: string; is_certificate_enabled: boolean; display_order: number
}

const BLANK_COURSE = {
  title: '', description: '', difficulty: 'beginner',
  estimatedDurationMinutes: '', skills: '', learningOutcomes: '',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: 'var(--muted)',  bg: 'var(--card2)' },
  review:    { label: 'Review',    color: '#f59e0b',       bg: 'rgba(245,158,11,0.1)' },
  published: { label: 'Published', color: 'var(--green)',  bg: 'var(--green-dim)' },
  archived:  { label: 'Archived',  color: 'var(--muted2)', bg: 'var(--card2)' },
}

export default function CoursesManagerClient({
  courses, moduleCounts,
}: { courses: Course[]; moduleCounts: Record<string, number> }) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(BLANK_COURSE)
  const [creating, setCreating] = useState(false)

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function callApi(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json() as { error?: string; [k: string]: unknown }
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json
  }

  async function createCourse() {
    if (!form.title.trim()) { showToast('Course title is required', 'error'); return }
    setCreating(true)
    try {
      await callApi({
        action: 'create_course', title: form.title.trim(),
        description: form.description.trim() || undefined,
        difficulty: form.difficulty,
        estimatedDurationMinutes: form.estimatedDurationMinutes ? Number(form.estimatedDurationMinutes) : undefined,
        skills: form.skills, learningOutcomes: form.learningOutcomes,
      })
      showToast('✓ Course created as a draft', 'success')
      setForm(BLANK_COURSE)
      setShowCreate(false)
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function updateCourse(courseId: string, updates: Record<string, unknown>, successMsg: string) {
    setBusy(courseId)
    try {
      await callApi({ action: 'update_course', courseId, ...updates })
      showToast(successMsg, 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteCourse(courseId: string, title: string) {
    if (!window.confirm(`Delete "${title}" and all of its modules, lessons, and student progress? This can't be undone.`)) return
    setBusy(`del-${courseId}`)
    try {
      await callApi({ action: 'delete_course', courseId })
      showToast('✓ Course deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)} style={{ fontSize: '13px' }}>
          {showCreate ? <><X size={14}/> Cancel</> : <><Plus size={14}/> New course</>}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: '24px', border: '1px solid var(--accent-ring)' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', marginBottom: '18px' }}>
            New course
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Title *</label>
              <input className="form-input" placeholder="e.g. Introduction to Data Structures"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={2} placeholder="Shown on the course card and landing page…"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ resize: 'vertical' }}/>
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label className="form-label">Difficulty</label>
                <select className="form-input" value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div style={{ width: '160px' }}>
                <label className="form-label">Est. duration (min)</label>
                <input className="form-input" type="number" min="0" placeholder="120"
                  value={form.estimatedDurationMinutes}
                  onChange={e => setForm(f => ({ ...f, estimatedDurationMinutes: e.target.value }))}/>
              </div>
            </div>
            <div>
              <label className="form-label">Skills covered (comma-separated)</label>
              <input className="form-input" placeholder="Arrays, Linked Lists, Recursion"
                value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Learning outcomes (one per line)</label>
              <textarea className="form-input" rows={3} placeholder="Understand core data structures&#10;Implement common algorithms from scratch"
                value={form.learningOutcomes} onChange={e => setForm(f => ({ ...f, learningOutcomes: e.target.value }))}
                style={{ resize: 'vertical' }}/>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={createCourse} disabled={creating} style={{ fontSize: '13px', padding: '10px 22px' }}>
                {creating ? <><Loader2 size={14} className="spin"/> Creating…</> : <><Check size={14}/> Create course</>}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setForm(BLANK_COURSE) }} style={{ fontSize: '13px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {courses.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          No courses yet. Create one above.
        </div>
      )}

      {courses.map(c => {
        const isOpen = expandedId === c.id
        const sm = STATUS_META[c.status] ?? STATUS_META.draft
        return (
          <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
              onClick={() => setExpandedId(isOpen ? null : c.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px' }}>{c.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  /courses/{c.slug} · {moduleCounts[c.id] ?? 0} module{(moduleCounts[c.id] ?? 0) !== 1 ? 's' : ''}
                </div>
              </div>
              <span className="pill" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              <button className="btn btn-danger" onClick={e => { e.stopPropagation(); deleteCourse(c.id, c.title) }}
                disabled={busy === `del-${c.id}`} style={{ fontSize: '11px', padding: '5px 10px' }}>
                {busy === `del-${c.id}` ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
              </button>
              {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }}/> : <ChevronDown size={16} style={{ color: 'var(--muted)' }}/>}
            </div>

            {isOpen && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label className="form-label">Status</label>
                    <select className="form-input" value={c.status} disabled={busy === c.id}
                      onChange={e => updateCourse(c.id, { status: e.target.value }, '✓ Status updated')}>
                      <option value="draft">Draft</option>
                      <option value="review">Review</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', paddingBottom: '10px' }}>
                    <input type="checkbox" checked={c.is_certificate_enabled} disabled={busy === c.id}
                      onChange={e => updateCourse(c.id, { isCertificateEnabled: e.target.checked }, e.target.checked ? '✓ Certificate enabled' : '✓ Certificate disabled')}/>
                    Certificate enabled
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link href={`/admin/courses/${c.id}`} className="btn btn-primary" style={{ fontSize: '13px' }}>
                    <Layers size={13}/> Manage modules & lessons <ArrowRight size={13}/>
                  </Link>
                  <Link href={`/admin/courses/${c.id}/learners`} className="btn btn-ghost" style={{ fontSize: '13px' }}>
                    <Users size={13}/> View learners
                  </Link>
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
