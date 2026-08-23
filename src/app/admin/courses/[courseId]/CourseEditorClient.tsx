'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Plus, Trash2, ChevronUp, ChevronDown, ChevronLeft,
  Pencil, FileEdit, Clock,
} from 'lucide-react'

interface CourseModule { id: string; title: string; module_number: number }
interface Lesson {
  id: string; module_id: string; title: string; lesson_number: number
  estimated_duration_minutes: number; is_required: boolean
}

export default function CourseEditorClient({
  course, modules, lessons,
}: {
  course: { id: string; title: string; slug: string; status: string }
  modules: CourseModule[]
  lessons: Lesson[]
}) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [addingModule, setAddingModule] = useState(false)

  const [lessonForms, setLessonForms] = useState<Record<string, { title: string; minutes: string; required: boolean }>>({})

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

  async function addModule() {
    if (!newModuleTitle.trim()) { showToast('Module title is required', 'error'); return }
    setAddingModule(true)
    try {
      await callApi({ action: 'create_module', courseId: course.id, title: newModuleTitle.trim() })
      showToast('✓ Module added', 'success')
      setNewModuleTitle('')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setAddingModule(false)
    }
  }

  async function renameModule(moduleId: string, title: string) {
    if (!title.trim()) return
    setBusy(`mod-${moduleId}`)
    try {
      await callApi({ action: 'update_module', moduleId, title: title.trim() })
      showToast('✓ Module renamed', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteModule(moduleId: string, title: string) {
    if (!window.confirm(`Delete module "${title}" and all of its lessons? This can't be undone.`)) return
    setBusy(`del-mod-${moduleId}`)
    try {
      await callApi({ action: 'delete_module', moduleId })
      showToast('✓ Module deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function moveModule(moduleId: string, direction: 'up' | 'down') {
    const sorted = [...modules].sort((a, b) => a.module_number - b.module_number)
    const idx = sorted.findIndex(m => m.id === moduleId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[swapIdx]
    setBusy(`move-mod-${moduleId}`)
    try {
      await callApi({ action: 'reorder_module', moduleId1: a.id, order1: b.module_number, moduleId2: b.id, order2: a.module_number })
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function addLesson(moduleId: string) {
    const form = lessonForms[moduleId] ?? { title: '', minutes: '', required: true }
    if (!form.title.trim()) { showToast('Lesson title is required', 'error'); return }
    setBusy(`add-lesson-${moduleId}`)
    try {
      await callApi({
        action: 'create_lesson', moduleId, title: form.title.trim(),
        estimatedDurationMinutes: form.minutes ? Number(form.minutes) : undefined,
        isRequired: form.required,
      })
      showToast('✓ Lesson added', 'success')
      setLessonForms(p => ({ ...p, [moduleId]: { title: '', minutes: '', required: true } }))
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function toggleLessonRequired(lessonId: string, isRequired: boolean) {
    setBusy(`lesson-${lessonId}`)
    try {
      await callApi({ action: 'update_lesson_meta', lessonId, isRequired })
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteLesson(lessonId: string, title: string) {
    if (!window.confirm(`Delete lesson "${title}"? This can't be undone.`)) return
    setBusy(`del-lesson-${lessonId}`)
    try {
      await callApi({ action: 'delete_lesson', lessonId })
      showToast('✓ Lesson deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function moveLesson(moduleId: string, lessonId: string, direction: 'up' | 'down') {
    const sorted = lessons.filter(l => l.module_id === moduleId).sort((a, b) => a.lesson_number - b.lesson_number)
    const idx = sorted.findIndex(l => l.id === lessonId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[swapIdx]
    setBusy(`move-lesson-${lessonId}`)
    try {
      await callApi({ action: 'reorder_lesson', lessonId1: a.id, order1: b.lesson_number, lessonId2: b.id, order2: a.lesson_number })
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const sortedModules = [...modules].sort((a, b) => a.module_number - b.module_number)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Link href="/admin/courses" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <ChevronLeft size={12}/> All courses
      </Link>

      {sortedModules.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          No modules yet. Add one below.
        </div>
      )}

      {sortedModules.map((m, mi) => {
        const moduleLessons = lessons.filter(l => l.module_id === m.id).sort((a, b) => a.lesson_number - b.lesson_number)
        const lessonForm = lessonForms[m.id] ?? { title: '', minutes: '', required: true }

        return (
          <div key={m.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--card2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
              }}>{m.module_number}</span>
              <input
                defaultValue={m.title}
                onBlur={e => { if (e.target.value.trim() !== m.title) renameModule(m.id, e.target.value) }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '14px', color: 'var(--text)',
                }}
              />
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button className="btn btn-ghost" style={{ padding: '4px 6px' }} disabled={mi === 0 || busy === `move-mod-${m.id}`}
                  onClick={() => moveModule(m.id, 'up')}><ChevronUp size={12}/></button>
                <button className="btn btn-ghost" style={{ padding: '4px 6px' }} disabled={mi === sortedModules.length - 1 || busy === `move-mod-${m.id}`}
                  onClick={() => moveModule(m.id, 'down')}><ChevronDown size={12}/></button>
                <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '11px' }}
                  disabled={busy === `del-mod-${m.id}`} onClick={() => deleteModule(m.id, m.title)}>
                  {busy === `del-mod-${m.id}` ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
                </button>
              </div>
            </div>

            <div style={{ padding: '10px 18px' }}>
              {moduleLessons.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '10px 0' }}>No lessons yet — add one below.</div>
              )}
              {moduleLessons.map((l, li) => (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0',
                  borderBottom: li < moduleLessons.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted2)', width: '18px', flexShrink: 0 }}>{l.lesson_number}</span>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--muted2)', flexShrink: 0 }}>
                    <Clock size={10}/> {l.estimated_duration_minutes}m
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" checked={l.is_required} disabled={busy === `lesson-${l.id}`}
                      onChange={e => toggleLessonRequired(l.id, e.target.checked)}/>
                    Required
                  </label>
                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                    <button className="btn btn-ghost" style={{ padding: '3px 5px' }} disabled={li === 0 || busy === `move-lesson-${l.id}`}
                      onClick={() => moveLesson(m.id, l.id, 'up')}><ChevronUp size={11}/></button>
                    <button className="btn btn-ghost" style={{ padding: '3px 5px' }} disabled={li === moduleLessons.length - 1 || busy === `move-lesson-${l.id}`}
                      onClick={() => moveLesson(m.id, l.id, 'down')}><ChevronDown size={11}/></button>
                    <Link href={`/admin/courses/${course.id}/lessons/${l.id}`} className="btn btn-ghost" style={{ padding: '3px 7px', fontSize: '11px' }}>
                      <FileEdit size={11}/> Content
                    </Link>
                    <button className="btn btn-danger" style={{ padding: '3px 7px' }}
                      disabled={busy === `del-lesson-${l.id}`} onClick={() => deleteLesson(l.id, l.title)}>
                      {busy === `del-lesson-${l.id}` ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '12px', marginTop: moduleLessons.length > 0 ? '4px' : 0 }}>
                <input className="form-input" placeholder="New lesson title" style={{ flex: 1, minWidth: '180px', fontSize: '12px', padding: '7px 10px' }}
                  value={lessonForm.title}
                  onChange={e => setLessonForms(p => ({ ...p, [m.id]: { ...lessonForm, title: e.target.value } }))}/>
                <input className="form-input" type="number" min="1" placeholder="min" style={{ width: '70px', fontSize: '12px', padding: '7px 10px' }}
                  value={lessonForm.minutes}
                  onChange={e => setLessonForms(p => ({ ...p, [m.id]: { ...lessonForm, minutes: e.target.value } }))}/>
                <button className="btn btn-primary" style={{ fontSize: '11px', padding: '7px 14px' }}
                  disabled={busy === `add-lesson-${m.id}`} onClick={() => addLesson(m.id)}>
                  {busy === `add-lesson-${m.id}` ? <Loader2 size={12} className="spin"/> : <><Plus size={12}/> Add lesson</>}
                </button>
              </div>
            </div>
          </div>
        )
      })}

      <div className="card" style={{ padding: '16px 18px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <Pencil size={14} style={{ color: 'var(--muted2)', flexShrink: 0 }}/>
        <input className="form-input" placeholder="New module title" style={{ flex: 1, fontSize: '13px' }}
          value={newModuleTitle} onChange={e => setNewModuleTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addModule() }}/>
        <button className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}
          disabled={addingModule} onClick={addModule}>
          {addingModule ? <Loader2 size={12} className="spin"/> : <><Plus size={12}/> Add module</>}
        </button>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  )
}
