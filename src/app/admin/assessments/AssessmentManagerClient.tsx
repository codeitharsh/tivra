'use client'

import { useState, useTransition } from 'react'
import { createClient as createSB } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Lock, Unlock, ChevronDown, ChevronUp, AlertTriangle, Check, CircleDot } from 'lucide-react'

interface Phase { id: string; title: string; phase_number: number }

function sb() {
  return createSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export default function AssessmentManagerClient({
  phases, assessments, questions,
}: {
  phases:      Phase[]
  assessments: Record<string, unknown>[]
  questions:   Record<string, unknown>[]
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [toast,     setToast]     = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [expanded,  setExpanded]  = useState<string|null>(null)
  const [saving,    setSaving]    = useState<string|null>(null)

  // New question form state per assessment
  const [newQ, setNewQ] = useState<Record<string, {
    question_text: string; options: [string,string,string,string];
    correct_answer: string; explanation: string;
  }>>({})

  // Dates for scheduling
  const [dates, setDates] = useState<Record<string,{date:string;time:string}>>({})

  const showToast = (msg:string, type:'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500)
  }

  // Create a new assessment for a phase that doesn't have one
  async function createAssessment(phaseId: string, phaseNum: number) {
    setSaving(phaseId)
    start(async () => {
      const { error } = await sb().from('assessments').insert({
        phase_id:         phaseId,
        title:            `Phase ${phaseNum} Final Assessment`,
        total_questions:  phaseNum === 1 ? 60 : 75,
        duration_minutes: phaseNum === 1 ? 90 : 120,
        passing_percent:  75,
        is_manually_unlocked: false,
      })
      if (error) showToast(error.message, 'error')
      else { showToast('✓ Assessment created', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  // Save schedule
  async function saveSchedule(assessmentId: string) {
    const d = dates[assessmentId]
    if (!d?.date || !d?.time) { showToast('Set both date and time', 'error'); return }
    setSaving(assessmentId)
    start(async () => {
      const dt = new Date(`${d.date}T${d.time}:00`).toISOString()
      const { error } = await sb().from('assessments')
        .update({ unlock_datetime: dt, is_manually_unlocked: false }).eq('id', assessmentId)
      if (error) showToast(error.message, 'error')
      else { showToast('✓ Schedule saved', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  // Toggle manual unlock
  async function toggleUnlock(assessmentId: string, current: boolean) {
    setSaving(assessmentId)
    start(async () => {
      const { error } = await sb().from('assessments')
        .update({ is_manually_unlocked: !current }).eq('id', assessmentId)
      if (error) showToast(error.message, 'error')
      else { showToast(!current ? '✓ Assessment unlocked' : 'Assessment re-locked', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  // Add a question
  async function addQuestion(assessmentId: string) {
    const q = newQ[assessmentId]
    if (!q?.question_text?.trim()) { showToast('Question text required', 'error'); return }
    if (q.options.some(o => !o.trim())) { showToast('Fill all 4 options', 'error'); return }
    if (!q.correct_answer) { showToast('Select the correct answer', 'error'); return }

    setSaving(`q-${assessmentId}`)
    start(async () => {
      const existingQs = questions.filter(x => x.assessment_id === assessmentId)
      const { error } = await sb().from('assessment_questions').insert({
        assessment_id: assessmentId,
        question_text: q.question_text.trim(),
        options:       q.options,
        correct_answer: q.correct_answer,
        explanation:   q.explanation?.trim() || null,
        order_num:     existingQs.length + 1,
      })
      if (error) showToast(error.message, 'error')
      else {
        showToast('✓ Question added', 'success')
        setNewQ(p => ({ ...p, [assessmentId]: { question_text:'', options:['','','',''], correct_answer:'', explanation:'' } }))
        router.refresh()
      }
      setSaving(null)
    })
  }

  // Delete a question
  async function deleteQuestion(questionId: string) {
    if (!confirm('Delete this question?')) return
    start(async () => {
      const { error } = await sb().from('assessment_questions').delete().eq('id', questionId)
      if (error) showToast(error.message, 'error')
      else { showToast('Question deleted', 'success'); router.refresh() }
    })
  }

  const now = new Date()

  return (
    <div>
      {phases.map(phase => {
        const assessment = assessments.find(a => a.phase_id === phase.id)
        const phaseQs    = questions.filter(q => q.assessment_id === (assessment?.id))
        const isOpen     = expanded === phase.id
        const aId        = assessment?.id as string|undefined
        const isUnlocked = assessment?.is_manually_unlocked ||
          (assessment?.unlock_datetime ? now >= new Date(assessment.unlock_datetime as string) : false)

        return (
          <div key={phase.id} className="card" style={{ marginBottom:'16px', padding:0, overflow:'hidden' }}>
            {/* Phase header */}
            <div style={{
              padding:'18px 22px', borderBottom: isOpen ? '1px solid var(--border)' : 'none',
              display:'flex', alignItems:'center', gap:'14px', cursor:'pointer',
            }} onClick={() => setExpanded(isOpen ? null : phase.id)}>
              <div style={{
                width:'28px', height:'28px', borderRadius:'6px', flexShrink:0,
                background: assessment ? (isUnlocked ? 'var(--green-dim)' : 'var(--amber-dim)') : 'var(--red-dim)',
                color: assessment ? (isUnlocked ? 'var(--green)' : 'var(--amber)') : 'var(--red)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {assessment ? (isUnlocked ? <CircleDot size={13}/> : <Lock size={13}/>) : <AlertTriangle size={13}/>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px' }}>
                  Phase {phase.phase_number}: {phase.title}
                </div>
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>
                  {assessment
                    ? `${phaseQs.length} questions · ${String(assessment.duration_minutes)} min · Pass: ${String(assessment.passing_percent)}%`
                    : 'No assessment created yet'}
                </div>
              </div>
              <span className="pill" style={{
                background: assessment
                  ? isUnlocked ? 'var(--green-dim)' : 'var(--amber-dim)'
                  : 'var(--red-dim)',
                color: assessment
                  ? isUnlocked ? 'var(--green)' : 'var(--amber)'
                  : 'var(--red)',
              }}>
                {assessment ? (isUnlocked ? 'Open' : 'Locked') : 'Not set up'}
              </span>
              {isOpen ? <ChevronUp size={16} style={{color:'var(--muted)'}}/> : <ChevronDown size={16} style={{color:'var(--muted)'}}/> }
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ padding:'22px' }}>

                {/* Create assessment if missing */}
                {!assessment && (
                  <div className="banner banner-warning" style={{ marginBottom:'20px' }}>
                    <AlertTriangle size={16} style={{ flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      No assessment exists for Phase {phase.phase_number} yet.
                    </div>
                    <button className="btn btn-primary" style={{ fontSize:'12px', padding:'7px 16px', flexShrink:0 }}
                      onClick={() => createAssessment(phase.id, phase.phase_number)}
                      disabled={saving === phase.id && isPending}>
                      {saving === phase.id && isPending
                        ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>
                        : <><Plus size={13}/> Create assessment</>}
                    </button>
                  </div>
                )}

                {assessment && aId && (
                  <>
                    {/* Schedule */}
                    <div style={{ marginBottom:'24px' }}>
                      <div className="stat-label" style={{ marginBottom:'12px' }}>
                        Unlock schedule
                      </div>
                      <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', flexWrap:'wrap' }}>
                        <div>
                          <label className="form-label">Unlock date</label>
                          <input type="date" className="form-input" style={{ fontSize:'13px', padding:'8px 12px' }}
                            value={dates[aId]?.date ?? ''}
                            onChange={e => setDates(p => ({...p, [aId]: {...p[aId], date: e.target.value}}))}/>
                        </div>
                        <div>
                          <label className="form-label">Unlock time</label>
                          <input type="time" className="form-input" style={{ fontSize:'13px', padding:'8px 12px' }}
                            value={dates[aId]?.time ?? ''}
                            onChange={e => setDates(p => ({...p, [aId]: {...p[aId], time: e.target.value}}))}/>
                        </div>
                        <button className="btn btn-ghost" onClick={() => saveSchedule(aId)}
                          disabled={saving === aId && isPending} style={{ fontSize:'12px', padding:'9px 16px' }}>
                          {saving === aId && isPending ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : 'Save schedule'}
                        </button>
                        <button
                          className={assessment.is_manually_unlocked ? 'btn btn-danger' : 'btn btn-success'}
                          onClick={() => toggleUnlock(aId, assessment.is_manually_unlocked as boolean)}
                          disabled={saving === aId && isPending}
                          style={{ fontSize:'12px', padding:'9px 16px' }}>
                          {assessment.is_manually_unlocked
                            ? <><Lock size={12}/> Re-lock</>
                            : <><Unlock size={12}/> Unlock now</>}
                        </button>
                      </div>
                      {assessment.unlock_datetime ? (
                        <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'8px' }}>
                          Current schedule: {new Date(assessment.unlock_datetime as string).toLocaleString('en-IN', {
                            day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
                          })}
                        </div>
                      ) : null}
                    </div>

                    {/* Questions list */}
                    <div style={{ marginBottom:'20px' }}>
                      <div className="stat-label" style={{ marginBottom:'12px', display:'flex', justifyContent:'space-between' }}>
                        <span>Questions ({phaseQs.length})</span>
                        <span style={{ color: phaseQs.length < 5 ? 'var(--red)' : 'var(--green)', fontWeight:400, fontSize:'11px', textTransform:'none', letterSpacing:0, display:'flex', alignItems:'center', gap:'4px' }}>
                          {phaseQs.length < 5 ? <><AlertTriangle size={11}/> Add more questions before going live</> : <><Check size={11}/> Good to go</>}
                        </span>
                      </div>

                      {phaseQs.length === 0 ? (
                        <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:'13px',
                          background:'var(--card2)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
                          No questions yet. Add your first question below.
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'400px', overflowY:'auto' }}>
                          {phaseQs.map((q, i) => (
                            <div key={q.id as string} style={{
                              padding:'12px 16px', borderRadius:'var(--radius-sm)',
                              background:'var(--card2)', border:'1px solid var(--border)',
                              display:'flex', gap:'12px', alignItems:'flex-start',
                            }}>
                              <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'12px',
                                color:'var(--muted)', flexShrink:0, minWidth:'24px' }}>
                                {i+1}.
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:'13px', fontWeight:500, marginBottom:'6px' }}>
                                  {String(q.question_text ?? '')}
                                </div>
                                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                  {(q.options as string[]).map((opt, oi) => {
                                    const letter = String.fromCharCode(65+oi)
                                    const isCorrect = letter === q.correct_answer
                                    return (
                                      <span key={oi} style={{
                                        fontSize:'11px', padding:'2px 8px', borderRadius:'6px',
                                        display:'inline-flex', alignItems:'center', gap:'4px',
                                        background: isCorrect ? 'var(--green-dim)' : 'rgba(255,255,255,0.05)',
                                        color: isCorrect ? 'var(--green)' : 'var(--muted)',
                                        border: `1px solid ${isCorrect ? 'rgba(74,222,128,0.2)' : 'transparent'}`,
                                      }}>
                                        {letter}. {opt}
                                        {isCorrect && <Check size={10}/>}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                              <button onClick={() => deleteQuestion(q.id as string)}
                                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)',
                                  padding:'4px', flexShrink:0 }} disabled={isPending}>
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add question form */}
                    <div style={{
                      padding:'18px', borderRadius:'var(--radius)',
                      background:'var(--accent-2-dim)', border:'1px solid rgba(23,174,224,0.2)',
                    }}>
                      <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'13px',
                        marginBottom:'14px', color:'var(--accent-2)', display:'flex', alignItems:'center', gap:'6px' }}>
                        <Plus size={13}/> Add new question
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                        <div>
                          <label className="form-label">Question text *</label>
                          <textarea className="form-input" rows={2} placeholder="Type the question here…"
                            value={newQ[aId]?.question_text ?? ''}
                            onChange={e => setNewQ(p => ({...p, [aId]: {...p[aId] ?? {options:['','','',''],correct_answer:'',explanation:''}, question_text: e.target.value}}))}
                            style={{ resize:'vertical' }}/>
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                          {['A','B','C','D'].map((letter, oi) => (
                            <div key={letter}>
                              <label className="form-label">Option {letter}</label>
                              <input className="form-input" placeholder={`Option ${letter}`}
                                value={newQ[aId]?.options?.[oi] ?? ''}
                                onChange={e => {
                                  const opts = [...(newQ[aId]?.options ?? ['','','',''])] as [string,string,string,string]
                                  opts[oi] = e.target.value
                                  setNewQ(p => ({...p, [aId]: {...p[aId] ?? {question_text:'',correct_answer:'',explanation:''}, options: opts}}))
                                }}/>
                            </div>
                          ))}
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                          <div>
                            <label className="form-label">Correct answer *</label>
                            <select className="form-select"
                              value={newQ[aId]?.correct_answer ?? ''}
                              onChange={e => setNewQ(p => ({...p, [aId]: {...p[aId] ?? {question_text:'',options:['','','',''],explanation:''}, correct_answer: e.target.value}}))}>
                              <option value="">Select correct option</option>
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label">Explanation (optional)</label>
                            <input className="form-input" placeholder="Why this is correct…"
                              value={newQ[aId]?.explanation ?? ''}
                              onChange={e => setNewQ(p => ({...p, [aId]: {...p[aId] ?? {question_text:'',options:['','','',''],correct_answer:''}, explanation: e.target.value}}))}/>
                          </div>
                        </div>

                        <button className="btn btn-primary" onClick={() => addQuestion(aId)}
                          disabled={saving === `q-${aId}` && isPending}
                          style={{ fontSize:'13px', padding:'10px 20px', alignSelf:'flex-start' }}>
                          {saving === `q-${aId}` && isPending
                            ? <><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Adding…</>
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

      {toast && <div style={{position:'fixed',bottom:'20px',right:'20px',zIndex:200}}>
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      </div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
