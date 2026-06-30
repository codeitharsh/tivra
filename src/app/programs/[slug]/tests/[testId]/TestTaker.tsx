'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Clock } from 'lucide-react'

interface Question {
  id: string
  question_text: string
  options: string[]
  // NOTE: correct_answer is intentionally NOT included — scoring is server-side
}

interface Test {
  id: string; title: string; topic: string | null
  duration_minutes: number; week_number: number
}

interface ServerResult {
  score:   number
  correct: number
  total:   number
}

interface Props {
  test: Test
  questions: Question[]
  isUnlocked: boolean
  existingAttempt: { score_percent: number; answers: Record<string,string>; submitted_at: string } | null
  studentId: string
  slug: string
}

export default function TestTaker({ test, questions, isUnlocked, existingAttempt, slug }: Props) {
  const [answers, setAnswers]       = useState<Record<string, string>>({})
  const [submitted, setSubmitted]   = useState(!!existingAttempt)
  const [result, setResult]         = useState<ServerResult | null>(
    existingAttempt ? {
      score:   existingAttempt.score_percent,
      correct: 0,
      total:   questions.length,
    } : null
  )
  const [timeLeft, setTimeLeft]     = useState(test.duration_minutes * 60)
  const [isPending, startTransition] = useTransition()
  const [started, setStarted]       = useState(!!existingAttempt)
  const [error, setError]           = useState<string | null>(null)
  const router                      = useRouter()

  // Wrapped in useCallback (was a plain function) — same fix as
  // AssessmentTaker.tsx's identical pattern: needed a stable identity
  // to correctly include it in the timer effect's dependency array
  // without the effect re-running every render.
  const handleSubmit = useCallback(async () => {
    if (submitted) return
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/submit-test', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ testId: test.id, answers }),
        })
        const data = await res.json() as { error?: string; score?: number; correct?: number; total?: number }

        if (!res.ok) {
          setError(data.error ?? 'Submission failed. Try again.')
          return
        }

        setResult({ score: data.score ?? 0, correct: data.correct ?? 0, total: data.total ?? questions.length })
        setSubmitted(true)
        router.refresh()
      } catch {
        setError('Network error. Check your connection and try again.')
      }
    })
  }, [submitted, test.id, answers, questions.length, router])

  // Timer
  useEffect(() => {
    if (!started || submitted) return
    if (timeLeft <= 0) {
      // Same genuinely-unavoidable case as AssessmentTaker.tsx: a
      // countdown reaching zero must trigger submission synchronously
      // within this effect — there's no user event to defer to.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSubmit()
      return
    }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [started, submitted, timeLeft, handleSubmit])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const timerColor = timeLeft < 60 ? 'var(--red)' : timeLeft < 300 ? 'var(--amber)' : 'var(--green)'

  const answeredCount = Object.keys(answers).length

  // ── Not yet unlocked ──────────────────────────────────────
  if (!isUnlocked) {
    return (
      <div className="card" style={{ textAlign:'center', padding:'60px 40px' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'20px', marginBottom:'8px' }}>
          Test Not Yet Available
        </div>
        <div style={{ fontSize:'14px', color:'var(--muted)', maxWidth:'360px', margin:'0 auto 24px' }}>
          This test will unlock on the scheduled date. Check the tests page for the countdown.
        </div>
        <a href={`/programs/${slug}/tests`} className="btn btn-ghost" style={{ fontSize:'13px', display:'inline-flex' }}>
          ← Back to Tests
        </a>
      </div>
    )
  }

  // ── Start screen ──────────────────────────────────────────
  if (!started) {
    return (
      <div className="card" style={{ textAlign:'center', padding:'48px 40px' }}>
        <div style={{ fontSize:'40px', marginBottom:'16px' }}>📝</div>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'20px', marginBottom:'8px' }}>
          Week {test.week_number}: {test.topic ?? test.title}
        </div>
        <div className='r-grid-3' style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', margin:'24px auto', maxWidth:'400px' }}>
          {[
            ['📋', String(questions.length), 'Questions'],
            ['⏱', String(test.duration_minutes), 'Minutes'],
            ['⚡', '1', 'Attempt'],
          ].map(([icon, val, label]) => (
            <div key={label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'10px', padding:'14px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:'20px', marginBottom:'4px' }}>{icon}</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'20px' }}>{val}</div>
              <div style={{ fontSize:'11px', color:'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>
        <div className="banner banner-warning" style={{ textAlign:'left', maxWidth:'400px', margin:'0 auto 24px' }}>
          <span>⚠️</span>
          <span style={{ fontSize:'13px' }}>One attempt only. Your score is submitted when the timer ends or you submit.</span>
        </div>
        <button className="btn btn-primary" onClick={() => setStarted(true)} style={{ fontSize:'14px', padding:'12px 32px' }}>
          Start Test →
        </button>
      </div>
    )
  }

  // ── Result screen ─────────────────────────────────────────
  if (submitted && result !== null) {
    const score = result.score
    return (
      <div>
        <div className="card" style={{
          textAlign:'center', padding:'36px', marginBottom:'20px',
          background: score >= 75
            ? 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(0,212,170,0.04))'
            : score >= 50
            ? 'linear-gradient(135deg,rgba(245,158,11,0.06),rgba(255,107,35,0.04))'
            : 'linear-gradient(135deg,rgba(239,68,68,0.06),rgba(180,40,40,0.04))',
          border: `1px solid ${score >= 75 ? 'rgba(34,197,94,0.2)' : score >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <div style={{ fontSize:'36px', marginBottom:'12px' }}>
            {score >= 75 ? '🏆' : score >= 50 ? '📈' : '📚'}
          </div>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'56px', lineHeight:1,
            color: score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)' }}>
            {Math.round(score)}%
          </div>
          {result.correct > 0 && (
            <div style={{ fontSize:'14px', color:'var(--muted)', marginTop:'6px' }}>
              {result.correct} of {result.total} correct
            </div>
          )}
          <div style={{ marginTop:'12px', fontSize:'15px', fontWeight:500 }}>
            {score >= 75 ? 'Great work! 🔥' : score >= 50 ? 'Good effort! Keep studying.' : 'Review your notes and keep going.'}
          </div>
        </div>
        <div style={{ marginTop:'20px' }}>
          <a href={`/programs/${slug}/tests`} className="btn btn-ghost" style={{ fontSize:'13px' }}>
            ← Back to Tests
          </a>
        </div>
      </div>
    )
  }

  // ── Active test ───────────────────────────────────────────
  return (
    <div>
      {/* Sticky timer */}
      <div style={{
        position:'sticky', top:'60px', zIndex:20,
        background:'var(--surface)', borderBottom:'1px solid var(--border)',
        padding:'12px 0 14px', marginBottom:'24px',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <span style={{ fontSize:'13px', color:'var(--muted)' }}>{answeredCount}/{questions.length} answered</span>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'18px', color:timerColor,
            display:'flex', alignItems:'center', gap:'6px' }}>
            <Clock size={16}/> {formatTime(timeLeft)}
          </span>
        </div>
        <div className="progress-track" style={{ height:'4px' }}>
          <div className="progress-fill" style={{ width:`${(answeredCount/questions.length)*100}%` }}/>
        </div>
      </div>

      {error && (
        <div className="banner banner-warning" style={{ marginBottom:'16px' }}>
          <span>⚠️</span><span style={{ fontSize:'13px' }}>{error}</span>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'20px', marginBottom:'24px' }}>
        {questions.map((q, i) => (
          <div key={q.id} className="card" style={{ padding:'20px' }}>
            <div style={{ fontSize:'14px', fontWeight:500, marginBottom:'16px' }}>
              <span style={{ color:'var(--muted)', marginRight:'8px' }}>Q{i+1}.</span>
              {q.question_text}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {q.options.map((opt, oi) => {
                const letter   = String.fromCharCode(65 + oi)
                const selected = answers[q.id] === letter
                return (
                  <button key={oi} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: letter }))}
                    style={{
                      textAlign:'left', padding:'12px 16px', borderRadius:'8px',
                      border:`1px solid ${selected ? 'rgba(59,91,219,0.5)' : 'var(--border)'}`,
                      background: selected ? 'rgba(59,91,219,0.12)' : 'rgba(255,255,255,0.03)',
                      color: selected ? '#fff' : 'var(--muted)',
                      cursor:'pointer', fontSize:'13px', transition:'all 0.15s',
                      fontFamily:'DM Sans,sans-serif',
                    }}>
                    <strong style={{ marginRight:'10px', color: selected ? 'var(--cyan)' : 'var(--muted)' }}>
                      {letter}.
                    </strong>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding:'20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:'13px', color:'var(--muted)' }}>
          {answeredCount < questions.length
            ? <span style={{ color:'var(--amber)' }}>⚠️ {questions.length - answeredCount} unanswered</span>
            : <span style={{ color:'var(--green)' }}>✓ All questions answered</span>
          }
        </div>
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={isPending || answeredCount === 0} style={{ fontSize:'13px', padding:'11px 24px' }}>
          {isPending
            ? <><Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> Submitting…</>
            : 'Submit Test →'
          }
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
