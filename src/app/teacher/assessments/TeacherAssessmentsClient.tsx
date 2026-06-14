'use client'

import { useState, useTransition } from 'react'
import { createClient as createSBClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Loader2, Lock, Unlock,
  ChevronDown, ChevronUp, Settings,
} from 'lucide-react'

interface Phase { id: string; title: string; phase_number: number }

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
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: !assessment ? 'var(--red)'
                  : isUnlocked ? 'var(--green)' : 'var(--amber)',
              }}/>

              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px' }}>
                  Phase {phase.phase_number}: {phase.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {assessment
                    ? `${qCount} question${qCount !== 1 ? 's' : ''} · ${String(assessment.duration_minutes)} min · Pass ${String(assessment.passing_percent)}%${aCount > 0 ? ` · ${aCount} attempt${aCount !== 1 ? 's' : ''}` : ''}`
                    : 'No assessment configured yet'}
                </div>
              </div>

              {assessment && (
                <>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                    background: isUnlocked ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                    color: isUnlocked ? 'var(--green)' : 'var(--amber)',
                  }}>
                    {isUnlocked ? '● Open' : '🔒 Locked'}
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
                      <span style={{ flexShrink: 0 }}>⚠️</span>
                      <span>No assessment exists for Phase {phase.phase_number}. Configure and create one below.</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label className="form-label">Assessment Title</label>
                        <input className="form-input"
                          placeholder={`Phase ${phase.phase_number} Final Assessment`}
                          value={cf.title}
                          onChange={e => setCreateForm(p => ({ ...p, [phase.id]: { ...cf, title: e.target.value } }))}/>
                      </div>
                      <div>
                        <label className="form-label">Total Questions</label>
                        <input className="form-input" type="number"
                          placeholder={phase.phase_number === 1 ? '60' : '75'}
                          value={cf.totalQ}
                          onChange={e => setCreateForm(p => ({ ...p, [phase.id]: { ...cf, totalQ: e.target.value } }))}/>
                      </div>
                      <div>
                        <label className="form-label">Duration (mins)</label>
                        <input className="form-input" type="number"
                          placeholder={phase.phase_number === 1 ? '90' : '120'}
                          value={cf.duration}
                          onChange={e => setCreateForm(p => ({ ...p, [phase.id]: { ...cf, duration: e.target.value } }))}/>
                      </div>
                      <div>
                        <label className="form-label">Pass Mark (%)</label>
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
                        : <><Plus size={13}/> Create Assessment</>}
                    </button>
                  </div>
                )}

                {/* ── Assessment exists → manage it ── */}
                {assessment && aId && (
                  <>
                    {/* Settings row */}
                    <div style={{
                      display: 'flex', gap: '20px', padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                      border: '1px solid var(--border)', marginBottom: '20px',
                      flexWrap: 'wrap',
                    }}>
                      {[
                        ['Title',     String(assessment.title ?? '')],
                        ['Questions', String(assessment.total_questions ?? '')],
                        ['Duration',  `${String(assessment.duration_minutes ?? '')} min`],
                        ['Pass Mark', `${String(assessment.passing_percent ?? '')}%`],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase',
                            letterSpacing: '0.07em', marginBottom: '3px' }}>{label}</div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Schedule */}
                    <div style={{
                      padding: '14px 16px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                      marginBottom: '20px',
                    }}>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '12px',
                        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)',
                        marginBottom: '10px' }}>
                        Unlock Schedule
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
                            : 'Save Schedule'}
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
                      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '12px',
                        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)',
                        marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Questions ({questions.length})</span>
                        <span style={{
                          color: questions.length < 5 ? 'var(--red)' : 'var(--green)',
                          fontWeight: 400, fontSize: '11px',
                        }}>
                          {questions.length < 5
                            ? `⚠ Add at least ${5 - questions.length} more before going live`
                            : `✓ ${questions.length} question${questions.length !== 1 ? 's' : ''} ready`}
                        </span>
                      </div>

                      {questions.length === 0 ? (
                        <div style={{
                          padding: '16px', textAlign: 'center', color: 'var(--muted)',
                          fontSize: '13px', background: 'rgba(255,255,255,0.02)',
                          borderRadius: '8px', border: '1px dashed var(--border)',
                        }}>
                          No questions yet. Add your first question below.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px',
                          maxHeight: '380px', overflowY: 'auto' }}>
                          {questions.map((q, i) => (
                            <div key={q.id as string} style={{
                              padding: '12px 14px', borderRadius: '8px',
                              background: 'rgba(255,255,255,0.025)',
                              border: '1px solid var(--border)',
                              display: 'flex', gap: '10px', alignItems: 'flex-start',
                            }}>
                              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700,
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
                                        background: isCorrect
                                          ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                                        color:      isCorrect ? 'var(--green)' : 'var(--muted)',
                                        border: `1px solid ${isCorrect
                                          ? 'rgba(34,197,94,0.2)' : 'transparent'}`,
                                      }}>
                                        {letter}. {opt}{isCorrect ? ' ✓' : ''}
                                      </span>
                                    )
                                  })}
                                </div>
                                {q.explanation
                                  ? <div style={{ fontSize: '11px', color: 'var(--muted)',
                                      marginTop: '4px', fontStyle: 'italic' }}>
                                      💡 {String(q.explanation)}
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
                      padding: '16px', borderRadius: '10px',
                      background: 'rgba(0,200,248,0.04)',
                      border: '1px solid rgba(0,200,248,0.15)',
                    }}>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '12px',
                        color: 'var(--teal)', marginBottom: '12px' }}>
                        + Add Question
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
                                  ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '10px',
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
                            : <><Plus size={13}/> Add Question</>}
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
