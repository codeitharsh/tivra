'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X, Check, Trash2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'

interface CareerPath {
  id: string; slug: string; title: string; description: string | null
  skills: string[]; price_inr: number | null; original_price_inr: number | null
  status: string; display_order: number
}
interface Link { career_path_id: string; course_id: string; display_order: number }
interface Course { id: string; title: string; slug: string; status: string }

const BLANK_PATH = {
  title: '', description: '', skills: '', priceInr: '', originalPriceInr: '',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: 'var(--muted)',     bg: 'var(--card2)' },
  published: { label: 'Published', color: 'var(--green-text)', bg: 'var(--green-dim)' },
}

function callApi(body: Record<string, unknown>) {
  return fetch('/api/admin/career-paths', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async res => {
    const json = await res.json() as { error?: string; [k: string]: unknown }
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json
  })
}

export default function CareerPathsManagerClient({
  careerPaths, links, allCourses,
}: { careerPaths: CareerPath[]; links: Link[]; allCourses: Course[] }) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addCourseSel, setAddCourseSel] = useState<Record<string, string>>({})

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(BLANK_PATH)
  const [creating, setCreating] = useState(false)

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function createPath() {
    if (!form.title.trim()) { showToast('Title is required', 'error'); return }
    setCreating(true)
    try {
      await callApi({
        action: 'create_career_path', title: form.title.trim(),
        description: form.description.trim() || undefined,
        skills: form.skills,
        priceInr: form.priceInr ? Number(form.priceInr) : undefined,
        originalPriceInr: form.originalPriceInr ? Number(form.originalPriceInr) : undefined,
      })
      showToast('✓ Career path created as a draft', 'success')
      setForm(BLANK_PATH)
      setShowCreate(false)
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function updatePath(id: string, updates: Record<string, unknown>, successMsg: string) {
    setBusy(id)
    try {
      await callApi({ action: 'update_career_path', careerPathId: id, ...updates })
      showToast(successMsg, 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deletePath(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? Students who bought it keep access to the courses they already own individually, but lose the bundle record. This can't be undone.`)) return
    setBusy(`del-${id}`)
    try {
      await callApi({ action: 'delete_career_path', careerPathId: id })
      showToast('✓ Career path deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function addCourse(pathId: string) {
    const courseId = addCourseSel[pathId]
    if (!courseId) { showToast('Pick a course first', 'error'); return }
    setBusy(`add-${pathId}`)
    try {
      await callApi({ action: 'add_course_to_path', careerPathId: pathId, courseId })
      showToast('✓ Course added', 'success')
      setAddCourseSel(p => ({ ...p, [pathId]: '' }))
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function removeCourse(pathId: string, courseId: string) {
    setBusy(`rm-${pathId}-${courseId}`)
    try {
      await callApi({ action: 'remove_course_from_path', careerPathId: pathId, courseId })
      showToast('✓ Course removed', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const courseById = new Map(allCourses.map(c => [c.id, c]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)} style={{ fontSize: '13px' }}>
          {showCreate ? <><X size={14}/> Cancel</> : <><Plus size={14}/> New career path</>}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: '24px', border: '1px solid var(--accent-ring)' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', marginBottom: '18px' }}>
            New career path
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Title *</label>
              <input className="form-input" placeholder="e.g. Data Analyst"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={2} placeholder="Shown on the role's landing page…"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ resize: 'vertical' }}/>
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label className="form-label">Bundle price (₹)</label>
                <input className="form-input" type="number" min="0" placeholder="e.g. 2999"
                  value={form.priceInr} onChange={e => setForm(f => ({ ...f, priceInr: e.target.value }))}/>
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label className="form-label">Original price (₹, optional)</label>
                <input className="form-input" type="number" min="0" placeholder="Strikethrough price"
                  value={form.originalPriceInr} onChange={e => setForm(f => ({ ...f, originalPriceInr: e.target.value }))}/>
              </div>
            </div>
            <div>
              <label className="form-label">Skills / technologies (comma-separated)</label>
              <input className="form-input" placeholder="Python, Excel, Power BI, SQL"
                value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}/>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={createPath} disabled={creating} style={{ fontSize: '13px', padding: '10px 22px' }}>
                {creating ? <><Loader2 size={14} className="spin"/> Creating…</> : <><Check size={14}/> Create career path</>}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setForm(BLANK_PATH) }} style={{ fontSize: '13px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {careerPaths.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          No career paths yet. Create one above.
        </div>
      )}

      {careerPaths.map(p => {
        const isOpen = expandedId === p.id
        const sm = STATUS_META[p.status] ?? STATUS_META.draft
        const memberLinks = links.filter(l => l.career_path_id === p.id)
        const availableCourses = allCourses.filter(c => !memberLinks.some(l => l.course_id === c.id))

        return (
          <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
              onClick={() => setExpandedId(isOpen ? null : p.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px' }}>{p.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  /explore/roles/{p.slug} · {memberLinks.length} course{memberLinks.length !== 1 ? 's' : ''}
                  {p.price_inr ? ` · ₹${p.price_inr.toLocaleString('en-IN')}` : ' · free'}
                </div>
              </div>
              <span className="pill" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              <button className="btn btn-danger" onClick={e => { e.stopPropagation(); deletePath(p.id, p.title) }}
                disabled={busy === `del-${p.id}`} style={{ fontSize: '11px', padding: '5px 10px' }}>
                {busy === `del-${p.id}` ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
              </button>
              {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }}/> : <ChevronDown size={16} style={{ color: 'var(--muted)' }}/>}
            </div>

            {isOpen && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label className="form-label">Status</label>
                    <select className="form-input" value={p.status} disabled={busy === p.id}
                      onChange={e => updatePath(p.id, { status: e.target.value }, '✓ Status updated')}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label className="form-label">Price (₹)</label>
                    <input className="form-input" type="number" min="0" disabled={busy === p.id}
                      defaultValue={p.price_inr ?? ''}
                      onBlur={e => {
                        const next = e.target.value ? Number(e.target.value) : null
                        if (next !== p.price_inr) updatePath(p.id, { priceInr: next }, '✓ Price updated')
                      }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label className="form-label">Original price (₹)</label>
                    <input className="form-input" type="number" min="0" disabled={busy === p.id}
                      defaultValue={p.original_price_inr ?? ''}
                      onBlur={e => {
                        const next = e.target.value ? Number(e.target.value) : null
                        if (next !== p.original_price_inr) updatePath(p.id, { originalPriceInr: next }, '✓ Original price updated')
                      }}/>
                  </div>
                </div>

                <div>
                  <div className="stat-label" style={{ marginBottom: '10px' }}>
                    Member courses (mandatory for this path)
                  </div>
                  {memberLinks.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0' }}>No courses added yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                      {memberLinks.map(l => {
                        const course = courseById.get(l.course_id)
                        return (
                          <div key={l.course_id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                            background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                          }}>
                            <BookOpen size={13} style={{ color: 'var(--muted2)', flexShrink: 0 }}/>
                            <span style={{ flex: 1, fontSize: '13px' }}>{course?.title ?? l.course_id}</span>
                            {course && course.status !== 'published' && (
                              <span className="pill" style={{ background: 'var(--card2)', color: 'var(--muted)', fontSize: '10px' }}>{course.status}</span>
                            )}
                            <button onClick={() => removeCourse(p.id, l.course_id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-text)', padding: '4px' }}
                              disabled={busy === `rm-${p.id}-${l.course_id}`}>
                              {busy === `rm-${p.id}-${l.course_id}` ? <Loader2 size={13} className="spin"/> : <X size={13}/>}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select className="form-select" style={{ flex: 1, fontSize: '12px' }}
                      value={addCourseSel[p.id] ?? ''}
                      onChange={e => setAddCourseSel(prev => ({ ...prev, [p.id]: e.target.value }))}>
                      <option value="">Select a course to add…</option>
                      {availableCourses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}{c.status !== 'published' ? ` (${c.status})` : ''}</option>
                      ))}
                    </select>
                    <button className="btn btn-ghost" style={{ fontSize: '12px' }}
                      disabled={busy === `add-${p.id}` || !addCourseSel[p.id]} onClick={() => addCourse(p.id)}>
                      {busy === `add-${p.id}` ? <Loader2 size={12} className="spin"/> : <><Plus size={12}/> Add</>}
                    </button>
                  </div>
                </div>

                {p.status === 'published' && memberLinks.some(l => courseById.get(l.course_id)?.status !== 'published') && (
                  <div className="banner banner-warning">
                    This path is published but includes a course that isn&apos;t — a buyer could pay for a
                    bundle containing a course they can&apos;t actually see yet.
                  </div>
                )}
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
