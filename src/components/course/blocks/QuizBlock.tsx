'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react'

// A formative, ungraded self-check embedded in lesson content — not the
// real test/assessment system (no server round-trip, no scoring, no
// certificate implication). correct_index is safe to ship to the client
// for exactly that reason: there's nothing to game.
export default function QuizBlock({
  question, options, correct_index, explanation,
}: { question: string; options: string[]; correct_index: number; explanation: string }) {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div className="card" style={{ padding: '20px', margin: '20px 0', borderLeft: '3px solid var(--accent-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <HelpCircle size={15} color="var(--accent-2)"/>
        <span style={{
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--accent-2)', fontFamily: 'var(--font-mono)',
        }}>Check your understanding</span>
      </div>

      <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '14px', lineHeight: 1.6 }}>{question}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrect  = i === correct_index
          let bg = 'var(--card2)', border = 'var(--border)', color = 'var(--text)'
          if (selected !== null) {
            if (isCorrect)          { bg = 'var(--green-dim)'; border = 'rgba(74,222,128,0.3)'; color = 'var(--green)' }
            else if (isSelected)    { bg = 'var(--red-dim)';   border = 'rgba(240,69,58,0.3)';  color = 'var(--red)' }
          }
          return (
            <button key={i} onClick={() => setSelected(i)} disabled={selected !== null} style={{
              textAlign: 'left', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${border}`, background: bg, color,
              cursor: selected === null ? 'pointer' : 'default',
              fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '10px', fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
            }}>
              <span>{opt}</span>
              {selected !== null && isCorrect && <CheckCircle2 size={14} style={{ flexShrink: 0 }}/>}
              {selected !== null && isSelected && !isCorrect && <XCircle size={14} style={{ flexShrink: 0 }}/>}
            </button>
          )
        })}
      </div>

      {selected !== null && (
        <div style={{ marginTop: '14px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
          {selected === correct_index
            ? <strong style={{ color: 'var(--green)' }}>Correct. </strong>
            : <strong style={{ color: 'var(--red)' }}>Not quite. </strong>}
          {explanation}
          {selected !== correct_index && (
            <button onClick={() => setSelected(null)} style={{
              marginLeft: '10px', background: 'none', border: 'none', color: 'var(--accent-2)',
              cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0,
              fontFamily: 'var(--font-sans)',
            }}>Try again</button>
          )}
        </div>
      )}
    </div>
  )
}
