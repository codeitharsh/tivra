'use client'

import { useState, useTransition } from 'react'
import { createClient as createSBClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Loader2, Lock, Unlock,
  ChevronDown, ChevronUp, CircleDot, AlertTriangle, Check, Lightbulb,
} from 'lucide-react'

interface Phase {
  id: string; title: string; phase_number: number
  program_id?: string
  programs?: { name: string; slug: string } | null
}

const BLANK_Q = {
  question_text: '',
  options: ['', '', '', ''] as [string, string, string, string],
  correct_answer: '',
  explanation: '',
}

// Read-only Supabase (for fetching questions)
function sbRead() {
  return createSBClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// All writes go through the API route
async function api(action: string, body: Record<string, unknown>, method: 'POST' | 'PATCH' | 'DELETE' = 'PATCH') {
  const res = await fetch('/api/tests', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, ...body }),
  })
  const json = await res.json() as { error?: string; assessmentId?: string }
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json
}

export default function TeacherAssessmentsClient({
  phases, assessments,
}: {
  phases:      Phase[]
  assessments: Record<string, unknown>[]
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [saving,     setSaving]     = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editQ,      setEditQ]      = useState<Record<string, typeof BLANK_Q>>({})
  const [dates,      setDates]      = useState<Record<string, { date: string; time: string }>>({})
  const [aQs,        setAQs]        = useState<Record<string, Record<string, unknown>[]>>({})
  const [creating,   setCreating]   = useState<string | null>(null) // phaseId being created

  // Create assessment form per phase
  const [createForm, setCreateForm] = useState<Record<string, {
    title: string; totalQ: string; duration: string; passing: string
  }>>({})

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function loadQuestions(assessmentId: string) {
    if (aQs[assessmentId]) return
    const { data } = await sbRead()
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('order_num')
    setAQs(p => ({ ...p, [assessmentId]: (data ?? []) as Record<string, unknown>[] }))
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    loadQuestions(id)
  }

  // ── Create assessment for a phase ────────────────────────
  async function createAssessment(phaseId: string, phaseNum: number) {
    const f = createForm[phaseId] ?? { title:'', totalQ:'', duration:'', passing:'' }
    const title    = f.title.trim() || `Phase ${phaseNum} Final Assessment`
    const totalQ   = Number(f.totalQ)   || (phaseNum === 1 ? 60 : 75)
    const duration = Number(f.duration) || (phaseNum === 1 ? 90 : 120)
    const passing  = Number(f.passing)  || 75

    setCreating(phaseId)
    try {
      await api('create_assessment', { phaseId, title, totalQuestions: totalQ, durationMinutes: duration, passingPercent: passing })
      showToast('✓ Assessment created', 'success')
      setCreating(null)
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
      setCreating(null)
    }
  }

  // ── Save schedule ─────────────────────────────────────────
  async function saveSchedule(assessmentId: string) {
    const d = dates[assessmentId]
    if (!d?.date || !d?.time) { showToast('Set both date and time', 'error'); return }
    setSaving(`sched-${assessmentId}`)
    start(async () => {
      try {
        const dt = new Date(`${d.date}T${d.time}:00`).toISOString()
        await api('save_assessment_schedule', { assessmentId, unlockDatetime: dt })
        showToast('✓ Schedule saved', 'success')
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  // ── Delete assessment ──────────────────────────────────────
  async function deleteAssessment(assessmentId: string, phaseTitle: string, attemptCountForDelete: number) {
    const warning = attemptCountForDelete > 0
      ? `Delete the assessment for "${phaseTitle}"? This will also permanently delete ${attemptCountForDelete} student attempt${attemptCountForDelete !== 1 ? 's' : ''} and any certificates already issued from it. This can't be undone.`
      : `Delete the assessment for "${phaseTitle}"? This can't be undone.`
    if (!confirm(warning)) return

    setSaving(`del-${assessmentId}`)
    start(async () => {
      try {
        await api('delete_assessment', { assessmentId })
        showToast('✓ Assessment deleted', 'success')
        setExpandedId(null)
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  // ── Toggle unlock ─────────────────────────────────────────
  async function toggleUnlock(assessmentId: string, current: boolean) {
    setSaving(`unlock-${assessmentId}`)
    start(async () => {
      try {
        await api('toggle_assessment_unlock', { assessmentId, isManuallyUnlocked: !current })
        showToast(!current ? '✓ Assessment unlocked' : 'Assessment re-locked', 'success')
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  // ── Add question ──────────────────────────────────────────
  async function addQuestion(assessmentId: string) {
    const q = editQ[assessmentId]
    if (!q?.question_text?.trim())      { showToast('Question text required', 'error'); return }
    if (q.options.some(o => !o.trim())) { showToast('Fill all 4 options', 'error');     return }
    if (!q.correct_answer)              { showToast('Select correct answer', 'error');  return }

    const currentQs = aQs[assessmentId] ?? []
    setSaving(`addq-${assessmentId}`)
    start(async () => {
      try {
        await api('add_assessment_question', {
          assessmentId,
          question: {
            question_text:  q.question_text.trim(),
            options:        q.options,
            correct_answer: q.correct_answer,
            explanation:    q.explanation?.trim() || null,
          },
          orderNum: currentQs.length + 1,
        })
        showToast('✓ Question added', 'success')
        setEditQ(p => ({ ...p, [assessmentId]: { ...BLANK_Q, options: ['','','',''] } }))
        // Reload questions
        setAQs(p => { const n = { ...p }; delete n[assessmentId]; return n })
        await loadQuestions(assessmentId)
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
      setSaving(null)
    })
  }

  // ── Delete question ───────────────────────────────────────
  async function deleteQuestion(questionId: string, assessmentId: string) {
    if (!confirm('Delete this question?')) return
    start(async () => {
      try {
        await api('delete_assessment_question', { questionId })
        showToast('Question deleted', 'success')
        setAQs(p => { const n = { ...p }; delete n[assessmentId]; return n })
        await loadQuestions(assessmentId)
        router.refresh()
      } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
    })
  }

  const now = new Date()

  return (
    <div>
      {phases.map(phase => {
        const assessment  = assessments.find(a => a.phase_id === phase.id)
        const aId         = assessment?.id as string | undefined
        const isOpen      = expandedId === (aId ?? phase.id)
        const questions   = aId ? (aQs[aId] ?? []) : []
        const qCount      = (assessment?.question_count as number) ?? 0
        const aCount      = (assessment?.attempt_count  as number) ?? 0
        const isUnlocked  = assessment?.is_manually_unlocked ||
          (assessment?.unlock_datetime
            ? now >= new Date(assessment.unlock_datetime as string)
            : false)

        const schBusy  = saving === `sched-${aId}`  && isPending
        const unlBusy  = saving === `unlock-${aId}` && isPending
        const addBusy  = saving === `addq-${aId}`   && isPending
        const delBusy  = saving === `del-${aId}`    && isPending
        const cf       = createForm[phase.id] ?? { title:'', totalQ:'', duration:'', passing:'' }

        return (
          <div key={phase.id} className="card" style={{ marginBottom: '16px', padding: 0, overflow: 'hidden' }}>

            {/* Phase header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: isOpen ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: '14px',
              cursor: 'pointer',
            }} onClick={() => aId ? toggleExpand(aId) : toggleExpand(phase.id)}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                background: !assessment ? 'var(--red-dim)' : isUnlocked ? 'var(--green-dim)' : 'var(--amber-dim)',
                color: !assessment ? 'var(--red)' : isUnlocked ? 'var(--green)' : 'var(--amber)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!assessment ? <AlertTriangle size={13}/> : isUnlocked ? <CircleDot size={13}/> : <Lock size={13}/>}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px' }}>
                  {phase.programs?.name ? `${phase.programs.name} — ` : ''}Phase {phase.phase_number}: {phase.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {assessment
                    ? `${qCount} question${qCount !== 1 ? 's' : ''} · ${String(assessment.duration_minutes)} min · Pass ${String(assessment.passing_percent)}%${aCount > 0 ? ` · ${aCount} attempt${aCount !== 1 ? 's' : ''}` : ''}`
                    : 'No assessment configured yet'}
                </div>
              </div>

              {assessment && (
                <>
                  <span className="pill" style={{
                    background: isUnlocked ? 'var(--green-dim)' : 'var(--amber-dim)',
                    color: isUnlocked ? 'var(--green)' : 'var(--amber)',
                  }}>
                    {isUnlocked ? <><CircleDot size={11}/> Open</> : <><Lock size={11}/> Locked</>}
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <button
                      className={assessment.is_manually_unlocked ? 'btn btn-danger' : 'btn btn-success'}
                      onClick={() => toggleUnlock(aId!, assessment.is_manually_unlocked as boolean)}
                      disabled={unlBusy} style={{ fontSize: '11px', padding: '5px 12px' }}>
                      {unlBusy
                        ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                        : assessment.is_manually_unlocked
                        ? <><Lock size={11}/> Lock</>
                        : <><Unlock size={11}/> Unlock</>}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteAssessment(aId!, `Phase ${phase.phase_number}: ${phase.title}`, aCount)}
                      disabled={delBusy} style={{ fontSize: '11px', padding: '5px 10px' }}
                      title="Delete assessment">
                      {delBusy
                        ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>
                        : <Trash2 size={11}/>}
                    </button>
                  </div>
                </>
              )}

              {isOpen
                ? <ChevronUp  size={16} style={{ color: 'var(--muted)', flexShrink: 0 }}/>
                : <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }}/>}
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ padding: '22px' }}>

                {/* ── No assessment yet → create form ── */}
                {!assessment && (
                  <div>
                    <div className="banner banner-warning" style={{ marginBottom: '20px' }}>
                      <AlertTriangle size={16} style={{ flexShrink: 0 }}/>
                      <span>No assessment exists for Phase {phase.phase_number}. Configure and create one below.</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label className="form-label">Assessment title</label>
                        <input className="form-input"
                          placeholder={`Phase ${phase.phase_number} Final Assessment`}
                          value={cf.title}
                          onChange={e => setCreateForm(p => ({ ...p, [phase.id]: { ...cf, title: e.target.value } }))}/>
                      </div>
                      <div>
                        <label className="form-label">Total questions</label>
                        <input className="form-input" type="number"
                          placeholder="e.g. 60"
                          value={cf.totalQ}
                          onChange={e => setCreateForm(p => ({ ...p, [phase.id]: { ...cf, totalQ: e.target.value } }))}/>
                      </div>
                      <div>
                        <label className="form-label">Duration (mins)</label>
                        <input className="form-input" type="number"
                          placeholder="e.g. 90"
                          value={cf.duration}
                          onChange={e => setCreateForm(p => ({ ...p, [phase.id]: { ...cf, duration: e.target.value } }))}/>
                      </div>
                      <div>
                        <label className="form-label">Pass mark (%)</label>
                        <input className="form-input" type="number" placeholder="75"
                          value={cf.passing}
                          onChange={e => setCreateForm(p => ({ ...p, [phase.id]: { ...cf, passing: e.target.value } }))}/>
                      </div>
                    </div>

                    <button className="btn btn-primary"
                      onClick={() => createAssessment(phase.id, phase.phase_number)}
                      disabled={creating === phase.id}
                      style={{ fontSize: '13px', padding: '10px 22px' }}>
                      {creating === phase.id
                        ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> Creating…</>
                        : <><Plus size={13}/> Create assessment</>}
                    </button>
                  </div>
                )}

                {/* ── Assessment exists → manage it ── */}
                {assessment && aId && (
                  <>
                    {/* Settings row */}
                    <div style={{
                      display: 'flex', gap: '20px', padding: '12px 16px',
                      background: 'var(--card2)', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)', marginBottom: '20px',
                      flexWrap: 'wrap',
                    }}>
                      {[
                        ['Title',     String(assessment.title ?? '')],
                        ['Questions', String(assessment.total_questions ?? '')],
                        ['Duration',  `${String(assessment.duration_minutes ?? '')} min`],
                        ['Pass mark', `${String(assessment.passing_percent ?? '')}%`],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div className="stat-label" style={{ marginBottom: '3px' }}>{label}</div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Schedule */}
                    <div style={{
                      padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--card2)', border: '1px solid var(--border)',
                      marginBottom: '20px',
                    }}>
                      <div className="stat-label" style={{ marginBottom: '10px' }}>
                        Unlock schedule
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                          <label className="form-label">Date</label>
                          <input type="date" className="form-input" style={{ fontSize: '12px', padding: '7px 10px' }}
                            value={dates[aId]?.date ?? ''}
                            onChange={e => setDates(p => ({ ...p, [aId]: { ...p[aId], date: e.target.value } }))}/>
                        </div>
                        <div>
                          <label className="form-label">Time</label>
                          <input type="time" className="form-input" style={{ fontSize: '12px', padding: '7px 10px' }}
                            value={dates[aId]?.time ?? ''}
                            onChange={e => setDates(p => ({ ...p, [aId]: { ...p[aId], time: e.target.value } }))}/>
                        </div>
                        <button className="btn btn-ghost" onClick={() => saveSchedule(aId)}
                          disabled={schBusy} style={{ fontSize: '12px', padding: '8px 14px' }}>
                          {schBusy
                            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/>
                            : 'Save schedule'}
                        </button>
                      </div>
                      {assessment.unlock_datetime && !assessment.is_manually_unlocked ? (
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                          Scheduled: {new Date(assessment.unlock_datetime as string).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      ) : null}
                    </div>

                    {/* Questions list */}
                    <div style={{ marginBottom: '16px' }}>
                      <div className="stat-label" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Questions ({questions.length})</span>
                        <span style={{
                          color: questions.length < 5 ? 'var(--red)' : 'var(--green)',
                          fontWeight: 400, fontSize: '11px', textTransform: 'none', letterSpacing: 0,
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          {questions.length < 5
                            ? <><AlertTriangle size={11}/> Add at least {5 - questions.length} more before going live</>
                            : <><Check size={11}/> {questions.length} question{questions.length !== 1 ? 's' : ''} ready</>}
                        </span>
                      </div>

                      {questions.length === 0 ? (
                        <div style={{
                          padding: '16px', textAlign: 'center', color: 'var(--muted)',
                          fontSize: '13px', background: 'var(--card2)',
                          borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)',
                        }}>
                          No questions yet. Add your first question below.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px',
                          maxHeight: '380px', overflowY: 'auto' }}>
                          {questions.map((q, i) => (
                            <div key={q.id as string} style={{
                              padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                              background: 'var(--card2)',
                              border: '1px solid var(--border)',
                              display: 'flex', gap: '10px', alignItems: 'flex-start',
                            }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600,
                                fontSize: '11px', color: 'var(--muted)', flexShrink: 0,
                                minWidth: '20px' }}>
                                {i + 1}.
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                                  {String(q.question_text ?? '')}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                  {(q.options as string[]).map((opt, oi) => {
                                    const letter    = String.fromCharCode(65 + oi)
                                    const isCorrect = letter === q.correct_answer
                                    return (
                                      <span key={oi} style={{
                                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        background: isCorrect
                                          ? 'var(--green-dim)' : 'rgba(255,255,255,0.05)',
                                        color:      isCorrect ? 'var(--green)' : 'var(--muted)',
                                        border: `1px solid ${isCorrect
                                          ? 'rgba(74,222,128,0.2)' : 'transparent'}`,
                                      }}>
                                        {letter}. {opt}{isCorrect && <Check size={10}/>}
                                      </span>
                                    )
                                  })}
                                </div>
                                {q.explanation
                                  ? <div style={{ fontSize: '11px', color: 'var(--muted)',
                                      marginTop: '4px', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                      <Lightbulb size={11} style={{ flexShrink: 0, marginTop: '1px' }}/> {String(q.explanation)}
                                    </div>
                                  : null}
                              </div>
                              <button onClick={() => deleteQuestion(q.id as string, aId)}
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

                    {/* Add question form */}
                    <div style={{
                      padding: '16px', borderRadius: 'var(--radius)',
                      background: 'var(--accent-2-dim)',
                      border: '1px solid rgba(23,174,224,0.2)',
                    }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '12px',
                        color: 'var(--accent-2)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={12}/> Add question
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <textarea className="form-input" rows={2}
                          placeholder="Question text…"
                          value={editQ[aId]?.question_text ?? ''}
                          onChange={e => setEditQ(p => ({
                            ...p, [aId]: { ...p[aId] ?? BLANK_Q, question_text: e.target.value },
                          }))}
                          style={{ resize: 'vertical' }}/>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                          {['A','B','C','D'].map((letter, oi) => (
                            <div key={letter} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{
                                width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                                background: editQ[aId]?.correct_answer === letter
                                  ? 'var(--green-dim)' : 'rgba(255,255,255,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px',
                                color: editQ[aId]?.correct_answer === letter
                                  ? 'var(--green)' : 'var(--muted)',
                              }}>
                                {letter}
                              </span>
                              <input className="form-input"
                                placeholder={`Option ${letter}`}
                                value={(editQ[aId]?.options ?? ['','','',''])[oi] ?? ''}
                                onChange={e => {
                                  const opts = [...(editQ[aId]?.options ?? ['','','',''])] as [string,string,string,string]
                                  opts[oi] = e.target.value
                                  setEditQ(p => ({ ...p, [aId]: { ...p[aId] ?? BLANK_Q, options: opts } }))
                                }}/>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px' }}>
                          <div>
                            <label className="form-label">Correct</label>
                            <select className="form-select"
                              value={editQ[aId]?.correct_answer ?? ''}
                              onChange={e => setEditQ(p => ({
                                ...p, [aId]: { ...p[aId] ?? BLANK_Q, correct_answer: e.target.value },
                              }))}>
                              <option value="">—</option>
                              {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label">Explanation (optional)</label>
                            <input className="form-input" placeholder="Why this is correct…"
                              value={editQ[aId]?.explanation ?? ''}
                              onChange={e => setEditQ(p => ({
                                ...p, [aId]: { ...p[aId] ?? BLANK_Q, explanation: e.target.value },
                              }))}/>
                          </div>
                        </div>

                        <button className="btn btn-primary"
                          onClick={() => addQuestion(aId)}
                          disabled={addBusy}
                          style={{ fontSize: '12px', padding: '9px 18px', alignSelf: 'flex-start' }}>
                          {addBusy
                            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> Adding…</>
                            : <><Plus size={13}/> Add question</>}
                        </button>
                      </div>
                    </div>
                  </>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
