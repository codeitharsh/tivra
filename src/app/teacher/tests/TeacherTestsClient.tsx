'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Loader2, Lock, Unlock,
  ChevronDown, ChevronUp, X, Check,
} from 'lucide-react'
import { createClient as createSBClient } from '@supabase/supabase-js'

function sbRead() {
  return createSBClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface Phase {
  id: string; title: string; phase_number: number
  modules: { id: string; title: string; module_number: number }[]
}

interface Props {
  phases:    Phase[]
  tests:     Record<string, unknown>[]
  programId: string
}

type Tab = 'tests' | 'create'

const BLANK_Q = {
  question_text: '',
  options: ['', '', '', ''] as [string, string, string, string],
  correct_answer: '',
  explanation: '',
}

export default function TeacherTestsClient({ phases, tests, programId }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [tab,        setTab]        = useState<Tab>('tests')
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [saving,     setSaving]     = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Create test form ─────────────────────────────────────
  const [form, setForm] = useState({
    title: '', topic: '', phase_id: '', week_number: '',
    duration_minutes: '30', date: '', time: '',
  })
  const [questions, setQuestions]  = useState<typeof BLANK_Q[]>([{ ...BLANK_Q, options: ['','','',''] }])
  const [creating,  setCreating]   = useState(false)

  // ── Question editor state per test ───────────────────────
  const [editQ,  setEditQ]  = useState<Record<string, typeof BLANK_Q>>({})
  const [dates,  setDates]  = useState<Record<string, { date: string; time: string }>>({})

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Add / remove question in create form ─────────────────
  function addQuestion() {
    setQuestions(prev => [...prev, { ...BLANK_Q, options: ['','','',''] }])
  }

  function removeQuestion(i: number) {
    setQuestions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateQuestion(i: number, field: string, value: string) {
    setQuestions(prev => prev.map((q, idx) =>
      idx === i ? { ...q, [field]: value } : q
    ))
  }

  function updateOption(i: number, oi: number, value: string) {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx !== i) return q
      const opts = [...q.options] as [string, string, string, string]
      opts[oi] = value
      return { ...q, options: opts }
    }))
  }

  // ── Create the test ───────────────────────────────────────
  async function createTest() {
    if (!form.title.trim())    { showToast('Title is required', 'error'); return }
    if (!form.phase_id)        { showToast('Select a phase', 'error'); return }
    if (!form.week_number)     { showToast('Enter a week number', 'error'); return }
    if (questions.length === 0){ showToast('Add at least 1 question', 'error'); return }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text.trim())           { showToast(`Q${i+1}: Question text missing`, 'error'); return }
      if (q.options.some(o => !o.trim()))    { showToast(`Q${i+1}: Fill all 4 options`, 'error'); return }
      if (!q.correct_answer)                 { showToast(`Q${i+1}: Select correct answer`, 'error'); return }
    }

    setCreating(true)
    try {
      const unlock_datetime = form.date && form.time
        ? new Date(`${form.date}T${form.time}:00`).toISOString()
        : null

      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:              'create_test',
          programId,
          phaseId:             form.phase_id,
          weekNumber:          Number(form.week_number),
          title:               form.title.trim(),
          topic:               form.topic.trim() || null,
          durationMinutes:     Number(form.duration_minutes),
          unlockDatetime:      unlock_datetime,
          isManuallyUnlocked:  !unlock_datetime,
          questions,
        }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create test')

      showToast(`✓ Test created with ${questions.length} question${questions.length !== 1 ? 's' : ''}!`, 'success')
      setForm({ title:'', topic:'', phase_id:'', week_number:'', duration_minutes:'30', date:'', time:'' })
      setQuestions([{ ...BLANK_Q, options: ['','','',''] }])
      setTab('tests')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  // ── Add question to existing test ────────────────────────
  async function addQuestionToTest(testId: string, questionCount: number) {
    const q = editQ[testId]
    if (!q?.question_text?.trim())        { showToast('Question text required', 'error'); return }
    if (q.options.some(o => !o.trim()))   { showToast('Fill all 4 options', 'error'); return }
    if (!q.correct_answer)                { showToast('Select the correct answer', 'error'); return }

    setSaving(`add-${testId}`)
    start(async () => {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_question',
          testId,
          question: {
            question_text:  q.question_text.trim(),
            options:        q.options,
            correct_answer: q.correct_answer,
            explanation:    q.explanation?.trim() || null,
            order_num:      questionCount + 1,
          },
        }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) showToast(json.error ?? 'Failed', 'error')
      else {
        showToast('✓ Question added', 'success')
        setEditQ(p => ({ ...p, [testId]: { ...BLANK_Q, options: ['','','',''] } }))
        router.refresh()
      }
      setSaving(null)
    })
  }

  // ── Delete a test ─────────────────────────────────────────
  async function deleteTest(testId: string, title: string) {
    if (!confirm(`Delete "${title}"? All questions and student attempts will be lost.`)) return
    setSaving(`del-${testId}`)
    start(async () => {
      const res = await fetch('/api/tests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_test', testId }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) showToast(json.error ?? 'Failed', 'error')
      else { showToast('Test deleted', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  // ── Delete a question ─────────────────────────────────────
  async function deleteQuestion(questionId: string) {
    if (!confirm('Delete this question?')) return
    start(async () => {
      const res = await fetch('/api/tests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_question', questionId }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) showToast(json.error ?? 'Failed', 'error')
      else { showToast('Question deleted', 'success'); router.refresh() }
    })
  }

  // ── Save schedule / toggle unlock ────────────────────────
  async function saveSchedule(testId: string) {
    const d = dates[testId]
    if (!d?.date || !d?.time) { showToast('Set both date and time', 'error'); return }
    setSaving(`sched-${testId}`)
    start(async () => {
      const dt = new Date(`${d.date}T${d.time}:00`).toISOString()
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_schedule', testId, unlockDatetime2: dt }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) showToast(json.error ?? 'Failed', 'error')
      else { showToast('✓ Schedule saved', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  async function toggleUnlock(testId: string, current: boolean) {
    setSaving(`unlock-${testId}`)
    start(async () => {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_unlock', testId, isManuallyUnlocked: !current }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) showToast(json.error ?? 'Failed', 'error')
      else { showToast(!current ? '✓ Test unlocked' : 'Test re-locked', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  const now = new Date()
  function getStatus(t: Record<string, unknown>) {
    if (t.is_manually_unlocked) return 'open'
    if (!t.unlock_datetime) return 'draft'
    return now >= new Date(t.unlock_datetime as string) ? 'open' : 'scheduled'
  }

  const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
    open:      { label: '● Open',      color: 'var(--green)', bg: 'rgba(34,197,94,0.12)'  },
    scheduled: { label: '⏰ Scheduled', color: 'var(--amber)', bg: 'rgba(245,158,11,0.12)' },
    draft:     { label: '✏ Draft',     color: 'var(--muted)', bg: 'rgba(255,255,255,0.06)' },
  }

  const phase1Tests = tests.filter(t => (t.phases as Record<string,unknown>|null)?.phase_number === 1)
  const phase2Tests = tests.filter(t => (t.phases as Record<string,unknown>|null)?.phase_number === 2)

  // ── Question bank fetch (via router, data passed as prop) ─
  // We'll load questions per test lazily from the DB when expanded
  const [testQuestions, setTestQuestions] = useState<Record<string, Record<string,unknown>[]>>({})

  async function loadQuestions(testId: string) {
    if (testQuestions[testId]) return
    const { data } = await sbRead()
      .from('test_questions')
      .select('*')
      .eq('test_id', testId)
      .order('order_num')
    setTestQuestions(p => ({ ...p, [testId]: (data ?? []) as Record<string,unknown>[] }))
  }

  function toggleExpand(testId: string) {
    if (expandedId === testId) {
      setExpandedId(null)
    } else {
      setExpandedId(testId)
      loadQuestions(testId)
    }
  }

  // ── Render: Test row ──────────────────────────────────────
  function TestRow({ t }: { t: Record<string, unknown> }) {
    const tid    = t.id as string
    const st     = getStatus(t)
    const cfg    = statusCfg[st]
    const isOpen = expandedId === tid
    const qCount = t.question_count as number
    const aCount = t.attempt_count as number
    const qs     = testQuestions[tid] ?? []
    const delBusy  = saving === `del-${tid}`    && isPending
    const savBusy  = saving === `sched-${tid}`  && isPending
    const unlBusy  = saving === `unlock-${tid}` && isPending
    const addBusy  = saving === `add-${tid}`    && isPending

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '10px' }}>
        {/* Header row */}
        <div style={{
          padding: '16px 20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '14px',
          borderBottom: isOpen ? '1px solid var(--border)' : 'none',
        }} onClick={() => toggleExpand(tid)}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>
              Week {String(t.week_number)} — {String(t.topic ?? t.title ?? '')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {qCount} question{qCount !== 1 ? 's' : ''}
              {' · '}{String(t.duration_minutes ?? 30)} min
              {aCount > 0 ? ` · ${aCount} attempt${aCount !== 1 ? 's' : ''}` : ''}
            </div>
          </div>

          <span style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
            fontWeight: 600, background: cfg.bg, color: cfg.color,
          }}>
            {cfg.label}
          </span>

          <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
            <button
              className={t.is_manually_unlocked ? 'btn btn-danger' : 'btn btn-success'}
              onClick={() => toggleUnlock(tid, t.is_manually_unlocked as boolean)}
              disabled={unlBusy} style={{ fontSize: '11px', padding: '5px 12px' }}>
              {unlBusy
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                : t.is_manually_unlocked
                ? <><Lock size={11}/> Lock</>
                : <><Unlock size={11}/> Unlock</>}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => deleteTest(tid, String(t.title ?? ''))}
              disabled={delBusy} style={{ fontSize: '11px', padding: '5px 10px' }}>
              {delBusy
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                : <Trash2 size={11}/>}
            </button>
          </div>

          {isOpen
            ? <ChevronUp size={16} style={{ color: 'var(--muted)', flexShrink: 0 }}/>
            : <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }}/>}
        </div>

        {isOpen && (
          <div style={{ padding: '20px' }}>

            {/* Schedule */}
            <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)',
                marginBottom: '10px' }}>
                Unlock Schedule
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input"
                    style={{ fontSize: '12px', padding: '7px 10px' }}
                    value={dates[tid]?.date ?? ''}
                    onChange={e => setDates(p => ({ ...p, [tid]: { ...p[tid], date: e.target.value } }))}/>
                </div>
                <div>
                  <label className="form-label">Time</label>
                  <input type="time" className="form-input"
                    style={{ fontSize: '12px', padding: '7px 10px' }}
                    value={dates[tid]?.time ?? ''}
                    onChange={e => setDates(p => ({ ...p, [tid]: { ...p[tid], time: e.target.value } }))}/>
                </div>
                <button className="btn btn-ghost" onClick={() => saveSchedule(tid)}
                  disabled={savBusy} style={{ fontSize: '12px', padding: '8px 14px' }}>
                  {savBusy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> : 'Save'}
                </button>
              </div>
              {t.unlock_datetime && !t.is_manually_unlocked ? (
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                  Scheduled: {new Date(t.unlock_datetime as string).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              ) : null}
            </div>

            {/* Questions list */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)',
                marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Questions ({qs.length})</span>
                {qs.length === 0 && <span style={{ color: 'var(--red)', fontWeight: 400, fontSize: '11px' }}>
                  ⚠ No questions yet
                </span>}
              </div>

              {qs.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)',
                  fontSize: '13px', background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px', border: '1px dashed var(--border)' }}>
                  No questions added yet. Add your first question below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px',
                  maxHeight: '360px', overflowY: 'auto' }}>
                  {qs.map((q, i) => (
                    <div key={q.id as string} style={{
                      padding: '12px 14px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid var(--border)',
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                    }}>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700,
                        fontSize: '11px', color: 'var(--muted)', flexShrink: 0, minWidth: '20px' }}>
                        {i + 1}.
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                          {String(q.question_text ?? '')}
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {(q.options as string[]).map((opt, oi) => {
                            const letter = String.fromCharCode(65 + oi)
                            const isCorrect = letter === q.correct_answer
                            return (
                              <span key={oi} style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                background: isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                                color: isCorrect ? 'var(--green)' : 'var(--muted)',
                                border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.2)' : 'transparent'}`,
                              }}>
                                {letter}. {opt}{isCorrect ? ' ✓' : ''}
                              </span>
                            )
                          })}
                        </div>
                        {q.explanation ? (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', fontStyle: 'italic' }}>
                            💡 {String(q.explanation)}
                          </div>
                        ) : null}
                      </div>
                      <button onClick={() => deleteQuestion(q.id as string)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--red)', padding: '4px', flexShrink: 0 }}
                        disabled={isPending}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add question to existing test */}
            <div style={{ padding: '16px', borderRadius: '10px',
              background: 'rgba(0,200,248,0.04)', border: '1px solid rgba(0,200,248,0.15)' }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '12px',
                color: 'var(--teal)', marginBottom: '12px' }}>
                + Add Question
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea className="form-input" rows={2} placeholder="Question text…"
                  value={editQ[tid]?.question_text ?? ''}
                  onChange={e => setEditQ(p => ({
                    ...p, [tid]: { ...p[tid] ?? BLANK_Q, question_text: e.target.value }
                  }))}
                  style={{ resize: 'vertical' }}/>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                  {['A','B','C','D'].map((letter, oi) => (
                    <div key={letter} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
                        width: '16px', flexShrink: 0 }}>{letter}.</span>
                      <input className="form-input" placeholder={`Option ${letter}`}
                        value={(editQ[tid]?.options ?? ['','','',''])[oi] ?? ''}
                        onChange={e => {
                          const opts = [...(editQ[tid]?.options ?? ['','','',''])] as [string,string,string,string]
                          opts[oi] = e.target.value
                          setEditQ(p => ({ ...p, [tid]: { ...p[tid] ?? BLANK_Q, options: opts } }))
                        }}/>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="form-label">Correct</label>
                    <select className="form-select"
                      value={editQ[tid]?.correct_answer ?? ''}
                      onChange={e => setEditQ(p => ({
                        ...p, [tid]: { ...p[tid] ?? BLANK_Q, correct_answer: e.target.value }
                      }))}>
                      <option value="">Select</option>
                      {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Explanation (optional)</label>
                    <input className="form-input" placeholder="Why this is correct…"
                      value={editQ[tid]?.explanation ?? ''}
                      onChange={e => setEditQ(p => ({
                        ...p, [tid]: { ...p[tid] ?? BLANK_Q, explanation: e.target.value }
                      }))}/>
                  </div>
                </div>

                <button className="btn btn-primary" onClick={() => addQuestionToTest(tid, qs.length)}
                  disabled={addBusy} style={{ fontSize: '12px', padding: '9px 18px', alignSelf: 'flex-start' }}>
                  {addBusy
                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> Adding…</>
                    : <><Plus size={13}/> Add Question</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {([['tests','All Tests'], ['create','Create New Test']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 20px', borderRadius: '100px', border: 'none',
            cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            fontFamily: 'DM Sans,sans-serif', transition: 'all 0.15s',
            background: tab === t
              ? 'linear-gradient(135deg,#00c8f8,#7030d0)'
              : 'rgba(255,255,255,0.06)',
            color: tab === t ? '#fff' : 'var(--muted)',
          }}>
            {t === 'create' && <Plus size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }}/>}
            {l}
          </button>
        ))}
      </div>

      {/* ── CREATE TEST TAB ── */}
      {tab === 'create' && (
        <div className="card" style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '18px',
            marginBottom: '22px' }}>
            Create New Weekly Test
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="form-label">Test Title *</label>
                <input className="form-input" placeholder="e.g. Week 3 — IAM Deep Dive"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
              </div>
              <div>
                <label className="form-label">Week Number *</label>
                <input className="form-input" type="number" min="1" max="8" placeholder="1–8"
                  value={form.week_number}
                  onChange={e => setForm(f => ({ ...f, week_number: e.target.value }))}/>
              </div>
              <div>
                <label className="form-label">Duration (mins)</label>
                <input className="form-input" type="number" min="10" max="120"
                  value={form.duration_minutes}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}/>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
              <div>
                <label className="form-label">Phase *</label>
                <select className="form-select" value={form.phase_id}
                  onChange={e => setForm(f => ({ ...f, phase_id: e.target.value }))}>
                  <option value="">Select phase…</option>
                  {phases.map(p => (
                    <option key={p.id} value={p.id}>
                      Phase {p.phase_number}: {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Topic / Subject</label>
                <input className="form-input" placeholder="e.g. IAM, EC2, S3…"
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}/>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
              <div>
                <label className="form-label">Unlock Date (optional)</label>
                <input className="form-input" type="date"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}/>
              </div>
              <div>
                <label className="form-label">Unlock Time</label>
                <input className="form-input" type="time"
                  value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}/>
              </div>
            </div>

            <div className="banner banner-info" style={{ margin: 0 }}>
              <span style={{ flexShrink: 0 }}>ℹ️</span>
              <span style={{ fontSize: '13px' }}>
                If no unlock date is set, the test will be <strong style={{ color: '#fff' }}>available immediately</strong> after creation.
                Set a date to schedule it for later.
              </span>
            </div>
          </div>

          {/* Questions */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '14px' }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px' }}>
                Questions ({questions.length})
              </h3>
              <button className="btn btn-ghost" onClick={addQuestion}
                style={{ fontSize: '12px', padding: '7px 14px' }}>
                <Plus size={13}/> Add Another
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {questions.map((q, i) => (
                <div key={i} style={{
                  padding: '18px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid var(--border)',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700,
                      fontSize: '13px', color: 'var(--muted)' }}>
                      Question {i + 1}
                    </div>
                    {questions.length > 1 && (
                      <button onClick={() => removeQuestion(i)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--red)', padding: '4px',
                      }}>
                        <X size={15}/>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea className="form-input" rows={2}
                      placeholder={`Question ${i + 1} text…`}
                      value={q.question_text}
                      onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                      style={{ resize: 'vertical' }}/>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                      {['A','B','C','D'].map((letter, oi) => (
                        <div key={letter} style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                          <span style={{
                            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                            background: q.correct_answer === letter
                              ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '10px',
                            color: q.correct_answer === letter ? 'var(--green)' : 'var(--muted)',
                          }}>
                            {letter}
                          </span>
                          <input className="form-input" placeholder={`Option ${letter}`}
                            value={q.options[oi]}
                            onChange={e => updateOption(i, oi, e.target.value)}/>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                      <div>
                        <label className="form-label">Correct *</label>
                        <select className="form-select"
                          value={q.correct_answer}
                          onChange={e => updateQuestion(i, 'correct_answer', e.target.value)}>
                          <option value="">—</option>
                          {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Explanation (optional)</label>
                        <input className="form-input" placeholder="Why this is correct…"
                          value={q.explanation}
                          onChange={e => updateQuestion(i, 'explanation', e.target.value)}/>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={createTest} disabled={creating}
              style={{ fontSize: '14px', padding: '12px 28px' }}>
              {creating
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/> Creating…</>
                : <><Check size={14}/> Create Test ({questions.length} question{questions.length !== 1 ? 's' : ''})</>}
            </button>
            <button className="btn btn-ghost" onClick={() => setTab('tests')}
              style={{ fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── ALL TESTS TAB ── */}
      {tab === 'tests' && (
        <div>
          {tests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>No tests created yet.</div>
              <button className="btn btn-primary" onClick={() => setTab('create')}
                style={{ fontSize: '13px', marginTop: '12px' }}>
                <Plus size={13}/> Create First Test
              </button>
            </div>
          ) : (
            <>
              {phase1Tests.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px',
                    color: '#f59e0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }}/>
                    Phase 1 — AWS industry certifications
                    <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--muted)' }}>
                      ({phase1Tests.length} test{phase1Tests.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {phase1Tests.map(t => <TestRow key={t.id as string} t={t}/>)}
                </div>
              )}

              {phase2Tests.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px',
                    color: '#00d4ff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#00d4ff' }}/>
                    Phase 2 — professional certifications Associate
                    <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--muted)' }}>
                      ({phase2Tests.length} test{phase2Tests.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {phase2Tests.map(t => <TestRow key={t.id as string} t={t}/>)}
                </div>
              )}

              {phase1Tests.length === 0 && phase2Tests.length === 0 && tests.length > 0 && (
                <div>{tests.map(t => <TestRow key={t.id as string} t={t}/>)}</div>
              )}
            </>
          )}
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
