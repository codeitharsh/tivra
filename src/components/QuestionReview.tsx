'use client'

import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react'
import type { QuestionBreakdownItem } from '@/lib/question-breakdown'

// Post-submission report — shared by TestTaker and AssessmentTaker's
// result screens. Renders every question with the student's pick and
// the actual correct answer highlighted, plus the explanation if the
// teacher wrote one. Only ever rendered once an attempt exists (the
// breakdown prop itself is never constructed pre-submission — see
// src/lib/question-breakdown.ts).
export default function QuestionReview({ breakdown }: { breakdown: QuestionBreakdownItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {breakdown.map((q, i) => (
        <div key={q.id} className="card" style={{
          padding: '20px',
          borderLeft: `3px solid ${q.is_correct ? 'var(--green)' : 'var(--red)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
            {q.is_correct
              ? <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: '2px' }}/>
              : <XCircle size={16} color="var(--red)" style={{ flexShrink: 0, marginTop: '2px' }}/>}
            <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.6 }}>
              <span style={{ color: 'var(--muted)', marginRight: '6px' }}>Q{i + 1}.</span>
              {q.question_text}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {q.options.map((opt, oi) => {
              const letter        = String.fromCharCode(65 + oi)
              const isCorrectOpt  = letter === q.correct_answer
              const isStudentPick = letter === q.student_answer

              let bg = 'var(--card2)', border = 'var(--border)', color = 'var(--muted)'
              if (isCorrectOpt)               { bg = 'var(--green-dim)'; border = 'rgba(74,222,128,0.3)'; color = 'var(--green)' }
              else if (isStudentPick)         { bg = 'var(--red-dim)';   border = 'rgba(240,69,58,0.3)';  color = 'var(--red)' }

              const label = isStudentPick && isCorrectOpt ? 'Your answer'
                : isStudentPick ? 'Your answer'
                : isCorrectOpt ? 'Correct answer'
                : null

              return (
                <div key={oi} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)', border: `1px solid ${border}`,
                  background: bg, color, fontSize: '13px',
                }}>
                  <strong style={{ flexShrink: 0 }}>{letter}.</strong>
                  <span style={{ flex: 1 }}>{opt}</span>
                  {label && (
                    <span style={{
                      flexShrink: 0, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}>
                      {isCorrectOpt ? <CheckCircle2 size={12}/> : <XCircle size={12}/>} {label}
                    </span>
                  )}
                </div>
              )
            })}
            {!q.student_answer && (
              <div style={{ fontSize: '12px', color: 'var(--amber)', marginTop: '2px' }}>
                You left this question unanswered.
              </div>
            )}
          </div>

          {q.explanation && (
            <div style={{
              marginTop: '12px', fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic',
              display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: 1.6,
            }}>
              <Lightbulb size={12} style={{ flexShrink: 0, marginTop: '2px' }}/> {q.explanation}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
