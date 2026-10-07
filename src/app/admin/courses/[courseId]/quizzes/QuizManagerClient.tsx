'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft,
  AlertTriangle, Check, CircleDot,
} from 'lucide-react'

interface CourseModule { id: string; title: string; module_number: number }
interface Quiz {
  id: string; title: string; quiz_type: 'module_test' | 'final_assessment'
  module_id: string | null; passing_percent: number
}
interface Question {
  id: string; quiz_id: string; question_text: string; options: string[]
  correct_answer: string; explanation: string | null; order_num: number
}

type NewQuestionForm = { question_text: string; options: string[]; correct_answer: string; explanation: string }
const BLANK_QUESTION: NewQuestionForm = { question_text: '', options: ['', '', '', ''], correct_answer: '', explanation: '' }

function callApi(body: Record<string, unknown>) {
  return fetch('/api/admin/courses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async res => {
    const json = await res.json() as { error?: string; [k: string]: unknown }
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json
  })
}

export default function QuizManagerClient({
  course, modules, quizzes, questions,
}: {
  course: { id: string; title: string; slug: string }
  modules: CourseModule[]
  quizzes: Quiz[]
  questions: Question[]
}) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [newQ, setNewQ] = useState<Record<string, NewQuestionForm>>({})

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function createQuiz(key: string, quizType: 'module_test' | 'final_assessment', moduleId: string | null, title: string) {
    setBusy(key)
    try {
      await callApi({ action: 'create_quiz', courseId: course.id, quizType, moduleId, title })
      showToast('✓ Quiz created', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function updatePassingPercent(quizId: string, passingPercent: number) {
    setBusy(quizId)
    try {
      await callApi({ action: 'update_quiz', quizId, passingPercent })
      showToast('✓ Pass mark updated', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteQuiz(quizId: string) {
    if (!window.confirm('Delete this quiz and all of its questions? This can\'t be undone.')) return
    setBusy(`del-${quizId}`)
    try {
      await callApi({ action: 'delete_quiz', quizId })
      showToast('✓ Quiz deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function addQuestion(quizId: string) {
    const q = newQ[quizId] ?? BLANK_QUESTION
    if (!q.question_text.trim()) { showToast('Question text is required', 'error'); return }
    if (q.options.some(o => !o.trim())) { showToast('Fill all 4 options', 'error'); return }
    if (!q.correct_answer) { showToast('Select the correct answer', 'error'); return }

    setBusy(`q-${quizId}`)
    try {
      await callApi({
        action: 'create_quiz_question', quizId,
        questionText: q.question_text.trim(), options: q.options,
        correctAnswer: q.correct_answer, explanation: q.explanation.trim() || undefined,
      })
      showToast('✓ Question added', 'success')
      setNewQ(p => ({ ...p, [quizId]: BLANK_QUESTION }))
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!window.confirm('Delete this question?')) return
    setBusy(`delq-${questionId}`)
    try {
      await callApi({ action: 'delete_quiz_question', questionId })
      showToast('✓ Question deleted', 'success')
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  function QuizCard({
    cardKey, label, quiz, onCreate,
  }: {
    cardKey: string; label: string; quiz: Quiz | undefined
    onCreate: () => void
  }) {
    const isOpen = expanded === cardKey
    const qQuestions = quiz ? questions.filter(q => q.quiz_id === quiz.id) : []
    const form = quiz ? (newQ[quiz.id] ?? BLANK_QUESTION) : BLANK_QUESTION

    return (
      <div className="card" style={{ marginBottom: '14px', padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px', borderBottom: isOpen ? '1px solid var(--border)' : 'none',
            display: 'flex', alignItems: 'center', gap: '14px', cursor: quiz ? 'pointer' : 'default',
          }}
          onClick={() => quiz && setExpanded(isOpen ? null : cardKey)}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
            background: quiz ? 'var(--green-dim)' : 'var(--red-dim)',
            color: quiz ? 'var(--green-text)' : 'var(--red-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {quiz ? <CircleDot size={13}/> : <AlertTriangle size={13}/>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px' }}>{label}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {quiz ? `${qQuestions.length} questions · Pass: ${quiz.passing_percent}%` : 'No quiz created yet'}
            </div>
          </div>
          {quiz ? (
            <>
              <button className="btn btn-danger" onClick={e => { e.stopPropagation(); deleteQuiz(quiz.id) }}
                disabled={busy === `del-${quiz.id}`} style={{ fontSize: '11px', padding: '5px 10px' }}>
                {busy === `del-${quiz.id}` ? <Loader2 size={11} className="spin"/> : <Trash2 size={11}/>}
              </button>
              {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }}/> : <ChevronDown size={16} style={{ color: 'var(--muted)' }}/>}
            </>
          ) : (
            <button className="btn btn-primary" style={{ fontSize: '12px', padding: '7px 16px' }}
              onClick={onCreate} disabled={busy === cardKey}>
              {busy === cardKey ? <Loader2 size={13} className="spin"/> : <><Plus size={13}/> Create quiz</>}
            </button>
          )}
        </div>

        {isOpen && quiz && (
          <div style={{ padding: '22px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <div style={{ width: '140px' }}>
                <label className="form-label">Pass mark (%)</label>
                <input className="form-input" type="number" min="0" max="100" defaultValue={quiz.passing_percent}
                  onBlur={e => {
                    const next = Number(e.target.value)
                    if (next && next !== quiz.passing_percent) updatePassingPercent(quiz.id, next)
                  }}/>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="stat-label" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Questions ({qQuestions.length})</span>
                <span style={{ color: qQuestions.length < 3 ? 'var(--red-text)' : 'var(--green-text)', fontWeight: 400, fontSize: '11px', textTransform: 'none', letterSpacing: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {qQuestions.length < 3 ? <><AlertTriangle size={11}/> Add more questions before publishing</> : <><Check size={11}/> Good to go</>}
                </span>
              </div>

              {qQuestions.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px',
                  background: 'var(--card2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  No questions yet. Add the first one below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {qQuestions.map((q, i) => (
                    <div key={q.id} style={{
                      padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--card2)', border: '1px solid var(--border)',
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                    }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '12px', color: 'var(--muted)', flexShrink: 0, minWidth: '20px' }}>
                        {i + 1}.
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>{q.question_text}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {q.options.map((opt, oi) => {
                            const isCorrect = opt === q.correct_answer
                            return (
                              <span key={oi} style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                background: isCorrect ? 'var(--green-dim)' : 'rgba(0,0,0,0.05)',
                                color: isCorrect ? 'var(--green-text)' : 'var(--muted)',
                                border: `1px solid ${isCorrect ? 'rgba(74,222,128,0.2)' : 'transparent'}`,
                              }}>
                                {opt}{isCorrect && <Check size={10}/>}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                      <button onClick={() => deleteQuestion(q.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-text)', padding: '4px', flexShrink: 0 }}
                        disabled={busy === `delq-${q.id}`}>
                        {busy === `delq-${q.id}` ? <Loader2 size={13} className="spin"/> : <Trash2 size={13}/>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '18px', borderRadius: 'var(--radius)', background: 'var(--accent-2-dim)', border: '1px solid rgba(74,63,224,0.2)' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '13px', marginBottom: '14px', color: 'var(--accent-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={13}/> Add new question
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Question text *</label>
                  <textarea className="form-input" rows={2} placeholder="Type the question here…" style={{ resize: 'vertical' }}
                    value={form.question_text}
                    onChange={e => setNewQ(p => ({ ...p, [quiz.id]: { ...form, question_text: e.target.value } }))}/>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {[0, 1, 2, 3].map(oi => (
                    <div key={oi}>
                      <label className="form-label">Option {oi + 1}</label>
                      <input className="form-input" placeholder={`Option ${oi + 1}`}
                        value={form.options[oi] ?? ''}
                        onChange={e => {
                          const opts = [...form.options]
                          opts[oi] = e.target.value
                          setNewQ(p => ({ ...p, [quiz.id]: { ...form, options: opts } }))
                        }}/>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <label className="form-label">Correct answer *</label>
                    <select className="form-select" value={form.correct_answer}
                      onChange={e => setNewQ(p => ({ ...p, [quiz.id]: { ...form, correct_answer: e.target.value } }))}>
                      <option value="">Select the correct option</option>
                      {form.options.map((opt, oi) => opt.trim() && (
                        <option key={oi} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Explanation (optional)</label>
                    <input className="form-input" placeholder="Why this is correct…"
                      value={form.explanation}
                      onChange={e => setNewQ(p => ({ ...p, [quiz.id]: { ...form, explanation: e.target.value } }))}/>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => addQuestion(quiz.id)}
                  disabled={busy === `q-${quiz.id}`} style={{ fontSize: '13px', padding: '10px 20px', alignSelf: 'flex-start' }}>
                  {busy === `q-${quiz.id}` ? <><Loader2 size={13} className="spin"/> Adding…</> : <><Plus size={13}/> Add question</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const finalAssessment = quizzes.find(q => q.quiz_type === 'final_assessment')
  const sortedModules = [...modules].sort((a, b) => a.module_number - b.module_number)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <Link href={`/admin/courses/${course.id}`} style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '14px' }}>
        <ChevronLeft size={12}/> Back to modules & lessons
      </Link>

      <div className="stat-label" style={{ marginBottom: '8px' }}>Module tests</div>
      {sortedModules.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', marginBottom: '14px' }}>
          Add modules first (on the modules & lessons page) before creating module tests.
        </div>
      )}
      {sortedModules.map(m => {
        const quiz = quizzes.find(q => q.quiz_type === 'module_test' && q.module_id === m.id)
        return (
          <QuizCard key={m.id} cardKey={`mod-${m.id}`} label={`Module ${m.module_number}: ${m.title}`} quiz={quiz}
            onCreate={() => createQuiz(`mod-${m.id}`, 'module_test', m.id, `${m.title} — Test`)}/>
        )
      })}

      <div className="stat-label" style={{ marginTop: '10px', marginBottom: '8px' }}>Final assessment</div>
      <QuizCard cardKey="final" label="Final Assessment" quiz={finalAssessment}
        onCreate={() => createQuiz('final', 'final_assessment', null, 'Final Assessment')}/>

      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
        A student unlocks a module test once that module&apos;s required lessons are done,
        and the final assessment once every lesson and every module test is passed —
        passing everything issues the course completion certificate automatically.
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
