'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Clock, Trophy, AlertTriangle, RotateCcw, Lock, ClipboardList,
  HelpCircle, Timer, Target, Zap, CheckCircle2, Frown, ArrowLeft, ArrowRight, Check,
} from 'lucide-react'
import QuestionReview from '@/components/QuestionReview'
import type { QuestionBreakdownItem } from '@/lib/question-breakdown'

interface Question {
  id: string
  question_text: string
  options: string[]
  // correct_answer intentionally NOT included — scoring is server-side
}

interface Assessment {
  id: string; title: string
  total_questions: number; duration_minutes: number; passing_percent: number
}

interface Attempt {
  id: string; score_percent: number; passed: boolean
  answers: Record<string,string>; submitted_at: string
}

interface Props {
  assessment:      Assessment
  questions:       Question[]
  isUnlocked:      boolean
  latestAttempt:   Attempt | null
  allAttempts:     Attempt[]
  attemptCount:    number
  canRetake:       boolean
  retakeUnlocksAt: string | null
  alreadyPassed:   boolean
  initialBreakdown: QuestionBreakdownItem[] | null
  studentId:       string
  studentName:     string
  slug:            string
}

type Screen = 'info' | 'confirm' | 'taking' | 'result'

function CooldownTimer({ unlocksAt, onUnlock }: { unlocksAt: string; onUnlock: () => void }) {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    let firedUnlock = false
    function compute() {
      const diff = new Date(unlocksAt).getTime() - Date.now()
      if (diff <= 0) {
        setDisplay('Unlocked!')
        // Previously the timer stopped here — it displayed "Unlocked!"
        // but nothing ever told the parent component the cooldown had
        // actually expired, so the Retake button stayed disabled
        // forever (driven by a static `canRetake` prop computed once
        // at server-render time). This callback is the actual fix:
        // it flips real client state the instant the countdown hits
        // zero, without requiring a manual page refresh.
        if (!firedUnlock) {
          firedUnlock = true
          onUnlock()
        }
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDisplay(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    compute()
    const id = setInterval(compute, 1000)
    return () => clearInterval(id)
  }, [unlocksAt, onUnlock])
  return <span style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'32px', color:'var(--amber)' }}>{display}</span>
}

export default function AssessmentTaker({
  assessment, questions, isUnlocked,
  latestAttempt, allAttempts, attemptCount,
  canRetake, retakeUnlocksAt, alreadyPassed, initialBreakdown, slug,
}: Props) {
  const router = useRouter()
  const [screen, setScreen]         = useState<Screen>(latestAttempt ? 'result' : 'info')
  const [answers, setAnswers]       = useState<Record<string, string>>({})
  const [serverResult, setResult]   = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null)
  const [breakdown, setBreakdown]   = useState<QuestionBreakdownItem[] | null>(initialBreakdown)
  const [timeLeft, setTimeLeft]     = useState(assessment.duration_minutes * 60)
  const [isPending, startTransition] = useTransition()
  const [currentQ, setCurrentQ]     = useState(0)
  const [submitError, setError]     = useState<string | null>(null)
  // True once the client-side countdown has independently confirmed
  // the 24-hour cooldown has expired — overrides the static `canRetake`
  // prop (which is only ever correct at the exact moment the server
  // rendered the page) without needing a manual refresh. This is the
  // actual fix for "can't retake even after 24 hours."
  const [cooldownExpired, setCooldownExpired] = useState(false)
  const effectiveCanRetake = canRetake || cooldownExpired

  const displayResult = serverResult
    ? { score_percent: serverResult.score, passed: serverResult.passed }
    : latestAttempt

  // Wrapped in useCallback (was a plain function) so it has a stable
  // identity across renders — needed to correctly include it in the
  // timer effect's dependency array below without the effect re-
  // running (and resetting the countdown) on every single render,
  // which is exactly what would happen with a plain function
  // reference that changes identity every time.
  const handleSubmit = useCallback(async () => {
    if (isPending) return
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/submit-assessment', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ assessmentId: assessment.id, answers }),
        })
        const data = await res.json() as {
          error?: string; retakeAt?: string
          score?: number; passed?: boolean; correct?: number; total?: number
          breakdown?: QuestionBreakdownItem[]
        }

        if (!res.ok) {
          if (res.status === 429 && data.retakeAt) {
            setError(`Cooldown active. Retake available at ${new Date(data.retakeAt).toLocaleString('en-IN')}`)
          } else {
            setError(data.error ?? 'Submission failed. Please try again.')
          }
          return
        }

        setResult({
          score:   data.score   ?? 0,
          passed:  data.passed  ?? false,
          correct: data.correct ?? 0,
          total:   data.total   ?? questions.length,
        })
        setBreakdown(data.breakdown ?? null)
        setScreen('result')
        router.refresh()
      } catch {
        setError('Network error. Check your connection and try again.')
      }
    })
  }, [isPending, assessment.id, answers, questions.length, router])

  useEffect(() => {
    if (screen !== 'taking') return
    if (timeLeft <= 0) {
      // A countdown reaching zero MUST trigger submission synchronously
      // within this effect — there's no event to defer to, unlike the
      // documented false-positive pattern in Topbar.tsx/Sidebar.tsx
      // (an effect calling a function that happens to setState). Here
      // the whole point of the effect IS to fire submission the instant
      // time runs out; deferring it via a microtask would only delay
      // submission by one tick with no actual benefit, while still
      // tripping the same rule. Disabling narrowly with this
      // justification on record, same pattern as Phase 1's fixes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSubmit()
      return
    }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [screen, timeLeft, handleSubmit])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }
  const timerColor = timeLeft < 120 ? 'var(--red)' : timeLeft < 600 ? 'var(--amber)' : 'var(--green)'
  const answeredCount = Object.keys(answers).length

  // ── Not unlocked ──────────────────────────────────────────
  if (!isUnlocked) {
    return (
      <div className="card" style={{ textAlign:'center', padding:'60px 40px', maxWidth:'560px', margin:'0 auto' }}>
        <Lock size={36} color="var(--muted2)" style={{ marginBottom:'16px' }}/>
        <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'20px', marginBottom:'8px' }}>
          Assessment not yet available
        </div>
        <div style={{ fontSize:'14px', color:'var(--muted)', maxWidth:'400px', margin:'0 auto 24px' }}>
          Complete all modules and wait for your admin to unlock this assessment.
        </div>
        <a href={`/programs/${slug}/assessments`} className="btn btn-ghost"
          style={{ fontSize:'13px', display:'inline-flex' }}><ArrowLeft size={13}/> Back to assessments</a>
      </div>
    )
  }

  // ── Cooldown screen ───────────────────────────────────────
  if (!effectiveCanRetake && !alreadyPassed && retakeUnlocksAt) {
    const lastScore = latestAttempt?.score_percent ?? 0
    return (
      <div>
        <div style={{ background:'var(--red-dim)', border:'1px solid rgba(240,69,58,0.2)',
          borderRadius:'var(--radius)', padding:'32px', textAlign:'center', marginBottom:'20px' }}>
          <Frown size={30} color="var(--red)" style={{ marginBottom:'12px' }}/>
          <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'44px', color:'var(--red)', lineHeight:1, marginBottom:'8px' }}>
            {Math.round(lastScore)}%
          </div>
          <div style={{ fontSize:'14px', color:'var(--muted)' }}>
            Pass mark is {assessment.passing_percent}% · Attempt {attemptCount}
          </div>
        </div>
        <div style={{ background:'var(--amber-dim)', border:'1px solid rgba(245,166,35,0.25)',
          borderRadius:'var(--radius)', padding:'32px', textAlign:'center', marginBottom:'20px' }}>
          <div className="stat-label" style={{ marginBottom:'12px', justifyContent:'center' }}>
            Next attempt available in
          </div>
          <CooldownTimer unlocksAt={retakeUnlocksAt} onUnlock={() => setCooldownExpired(true)}/>
          <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'12px' }}>
            Use this time to review your notes.
          </div>
        </div>
        <a href={`/programs/${slug}/assessments`} className="btn btn-ghost" style={{ fontSize:'13px' }}>
          <ArrowLeft size={13}/> Back to assessments
        </a>
      </div>
    )
  }

  // ── Info screen ───────────────────────────────────────────
  if (screen === 'info') {
    const isRetake = attemptCount > 0 && !alreadyPassed
    return (
      <div className="card" style={{ padding:'40px', maxWidth:'560px', margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          {isRetake ? <RotateCcw size={32} color="var(--amber)" style={{ marginBottom:'16px' }}/>
                    : <ClipboardList size={32} color="var(--accent)" style={{ marginBottom:'16px' }}/>}
          <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'22px', marginBottom:'8px' }}>
            {isRetake ? `Retake — Attempt #${attemptCount + 1}` : assessment.title}
          </div>
          {isRetake && latestAttempt && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'6px 14px',
              borderRadius:'var(--radius-pill)', background:'var(--amber-dim)', border:'1px solid rgba(245,166,35,0.2)',
              fontSize:'12px', color:'var(--amber)', marginBottom:'8px' }}>
              <RotateCcw size={12}/>
              Last: {Math.round(latestAttempt.score_percent)}% — Need {assessment.passing_percent}%
            </div>
          )}
        </div>
        <div className='r-grid-3' style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'28px' }}>
          {[
            { Icon: HelpCircle, val: String(questions.length), label: 'Questions' },
            { Icon: Timer, val: `${assessment.duration_minutes} min`, label: 'Duration' },
            { Icon: Target, val: `${assessment.passing_percent}%`, label: 'Pass mark' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'16px', textAlign:'center' }}>
              <s.Icon size={18} color="var(--muted)" style={{ marginBottom:'6px' }}/>
              <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'18px' }}>{s.val}</div>
              <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'3px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="banner banner-warning" style={{ marginBottom:'24px' }}>
          <AlertTriangle size={16} style={{ flexShrink:0 }}/>
          <span style={{ fontSize:'13px' }}>
            {isRetake
              ? <>Retake: score below {assessment.passing_percent}% triggers a 24-hour cooldown.</>
              : <>Score below {assessment.passing_percent}% triggers a 24-hour cooldown before retake.</>
            }
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => setScreen('confirm')}
          style={{ width:'100%', justifyContent:'center', fontSize:'15px', padding:'14px' }}>
          {isRetake ? <><RotateCcw size={14}/> Start retake</> : <>I&apos;m ready</>}
        </button>
        <div style={{ textAlign:'center', marginTop:'14px' }}>
          <a href={`/programs/${slug}/assessments`}
            style={{ fontSize:'13px', color:'var(--muted)', textDecoration:'none' }}>
            ← Back
          </a>
        </div>
      </div>
    )
  }

  // ── Confirm modal ─────────────────────────────────────────
  if (screen === 'confirm') {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
        <div className="card" style={{ padding:'36px', maxWidth:'440px', width:'90%', textAlign:'center' }}>
          <Zap size={34} color="var(--accent)" style={{ marginBottom:'16px' }}/>
          <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'20px', marginBottom:'8px' }}>
            Start assessment?
          </div>
          <div style={{ fontSize:'14px', color:'var(--muted)', marginBottom:'24px', lineHeight:1.6 }}>
            Timer starts immediately. <strong style={{ color:'var(--text)' }}>{assessment.duration_minutes} minutes</strong> for{' '}
            <strong style={{ color:'var(--text)' }}>{questions.length} questions</strong>.
          </div>
          <div style={{ display:'flex', gap:'12px' }}>
            <button className="btn btn-primary" style={{ flex:1, justifyContent:'center', fontSize:'14px' }}
              onClick={() => setScreen('taking')}><Check size={14}/> Start now</button>
            <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}
              onClick={() => setScreen('info')}>Go back</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Result screen ─────────────────────────────────────────
  if (screen === 'result' && displayResult) {
    const score  = displayResult.score_percent
    const passed = displayResult.passed
    return (
      <div>
        <div style={{
          background: passed ? 'var(--green-dim)' : 'var(--red-dim)',
          border:`1px solid ${passed ? 'rgba(74,222,128,0.25)' : 'rgba(240,69,58,0.2)'}`,
          borderRadius:'var(--radius)', padding:'36px', textAlign:'center', marginBottom:'24px',
        }}>
          {passed ? <Trophy size={34} color="var(--green)" style={{ marginBottom:'12px' }}/>
                  : <Frown size={34} color="var(--red)" style={{ marginBottom:'12px' }}/>}
          <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'52px', lineHeight:1,
            color: passed ? 'var(--green)' : 'var(--red)', marginBottom:'8px' }}>
            {Math.round(score)}%
          </div>
          {breakdown && (
            <div style={{ fontSize:'14px', color:'var(--muted)', marginBottom:'8px' }}>
              {breakdown.filter(b => b.is_correct).length} of {breakdown.length} correct
            </div>
          )}
          <div style={{ fontSize:'16px', fontWeight:600, marginBottom:'20px' }}>
            {passed ? 'You passed — certificate issued.' : `Need ${assessment.passing_percent}% to pass. Retake available in 24 hours.`}
          </div>
          {passed && (
            <a href={`/programs/${slug}/certificate`} className="btn btn-primary"
              style={{ fontSize:'14px', padding:'12px 28px', display:'inline-flex' }}>
              <Trophy size={15}/> View certificate
            </a>
          )}
        </div>

        {/* Attempt history */}
        {allAttempts.length > 1 && (
          <div className="card" style={{ marginBottom:'20px', padding:'16px 20px' }}>
            <div className="stat-label" style={{ marginBottom:'12px' }}>
              Attempt history
            </div>
            {allAttempts.map((att, i) => (
              <div key={att.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 0', borderBottom: i < allAttempts.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                fontSize:'13px' }}>
                <span style={{ color:'var(--muted)' }}>Attempt #{allAttempts.length - i}</span>
                <span style={{ color:'var(--muted)', fontSize:'11px' }}>
                  {new Date(att.submitted_at).toLocaleDateString('en-IN')}
                </span>
                <span style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px',
                  color: att.passed ? 'var(--green)' : 'var(--red)' }}>
                  {Math.round(att.score_percent)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {breakdown && (
          <div style={{ marginBottom: '20px' }}>
            <div className="stat-label" style={{ marginBottom: '12px' }}>Question review</div>
            <QuestionReview breakdown={breakdown}/>
          </div>
        )}

        <a href={`/programs/${slug}/assessments`} className="btn btn-ghost" style={{ fontSize:'13px' }}>
          <ArrowLeft size={13}/> Back to assessments
        </a>
      </div>
    )
  }

  // ── Taking screen ─────────────────────────────────────────
  return (
    <div>
      <div style={{ position:'sticky', top:'60px', zIndex:20, background:'var(--surface)',
        borderBottom:'1px solid var(--border)', padding:'12px 0 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <div style={{ fontSize:'13px', color:'var(--muted)' }}>
            Q{currentQ+1}/{questions.length} · {answeredCount} answered
          </div>
          <span style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'20px', color:timerColor,
            display:'flex', alignItems:'center', gap:'6px' }}>
            <Clock size={16}/> {formatTime(timeLeft)}
          </span>
        </div>
        <div className="progress-track" style={{ height:'4px' }}>
          <div className="progress-fill" style={{ width:`${(answeredCount/questions.length)*100}%` }}/>
        </div>
      </div>

      {/* Question navigator */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', margin:'20px 0 24px' }}>
        {questions.map((q, i) => (
          <button key={i} onClick={() => setCurrentQ(i)} style={{
            width:'32px', height:'32px', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer',
            fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'11px',
            background: currentQ === i
              ? 'var(--accent)'
              : answers[q.id] ? 'var(--green-dim)' : 'rgba(255,255,255,0.06)',
            color: currentQ === i ? 'var(--on-accent)' : answers[q.id] ? 'var(--green)' : 'var(--muted)',
          }}>{i+1}</button>
        ))}
      </div>

      {submitError && (
        <div className="banner banner-warning" style={{ marginBottom:'16px' }}>
          <AlertTriangle size={15} style={{ flexShrink:0 }}/><span style={{ fontSize:'13px' }}>{submitError}</span>
        </div>
      )}

      {questions[currentQ] && (
        <div className="card" style={{ padding:'24px', marginBottom:'16px' }}>
          <div style={{ fontSize:'15px', fontWeight:500, marginBottom:'20px', lineHeight:1.6 }}>
            <span style={{ color:'var(--muted)', marginRight:'8px', fontSize:'13px' }}>Q{currentQ+1}.</span>
            {questions[currentQ].question_text}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {questions[currentQ].options.map((opt, oi) => {
              const letter   = String.fromCharCode(65 + oi)
              const selected = answers[questions[currentQ].id] === letter
              return (
                <button key={oi} onClick={() => setAnswers(prev => ({ ...prev, [questions[currentQ].id]: letter }))}
                  style={{
                    textAlign:'left', padding:'14px 18px', borderRadius:'var(--radius-sm)',
                    border:`1px solid ${selected ? 'var(--accent-ring)' : 'var(--border)'}`,
                    background: selected ? 'var(--accent-dim)' : 'var(--card2)',
                    color: selected ? 'var(--text)' : 'var(--muted)',
                    cursor:'pointer', fontSize:'14px', transition:'all 0.15s',
                    fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:'12px',
                  }}>
                  <span style={{
                    width:'26px', height:'26px', borderRadius:'50%', flexShrink:0,
                    border:`2px solid ${selected ? 'var(--accent-2)' : 'rgba(255,255,255,0.15)'}`,
                    background: selected ? 'var(--accent-2-dim)' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'11px',
                    color: selected ? 'var(--accent-2)' : 'var(--muted)',
                  }}>{letter}</span>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
        <button className="btn btn-ghost" onClick={() => setCurrentQ(q => Math.max(0,q-1))}
          disabled={currentQ===0} style={{ flex:1, justifyContent:'center', fontSize:'13px' }}>
          <ArrowLeft size={13}/> Previous
        </button>
        {currentQ < questions.length-1 ? (
          <button className="btn btn-primary" onClick={() => setCurrentQ(q => Math.min(questions.length-1,q+1))}
            style={{ flex:1, justifyContent:'center', fontSize:'13px' }}>
            Next <ArrowRight size={13}/>
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isPending}
            style={{ flex:2, justifyContent:'center', fontSize:'14px' }}>
            {isPending
              ? <><Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> Submitting…</>
              : <><CheckCircle2 size={14}/> Submit assessment</>}
          </button>
        )}
      </div>

      {currentQ < questions.length-1 && (
        <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'14px',
          padding:'14px 0', borderTop:'1px solid var(--border)' }}>
          {answeredCount < questions.length && (
            <span style={{ fontSize:'12px', color:'var(--amber)', display:'inline-flex', alignItems:'center', gap:'6px' }}>
              <AlertTriangle size={12}/> {questions.length-answeredCount} unanswered
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSubmit}
            disabled={isPending||answeredCount===0} style={{ fontSize:'13px', padding:'10px 24px' }}>
            {isPending
              ? <><Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> Submitting…</>
              : 'Submit assessment'}
          </button>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
