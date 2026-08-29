'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react'
import { renderInlineSafe } from '@/lib/safe-richtext'

// A "Try it yourself" / "Show answer" style reveal — the cheapest form
// of interactivity that still meaningfully changes how a learner engages
// with content (predict-then-check) instead of just reading straight
// through. Same safe inline-formatting parser as paragraph/callout/list.
export default function ToggleBlock({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ margin: '16px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
        background: 'var(--card2)', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: '13px', fontWeight: 600, color: 'var(--accent-2)', fontFamily: 'var(--font-sans)',
      }}>
        {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
        <Lightbulb size={14} style={{ flexShrink: 0 }}/>
        {label}
      </button>
      {open && (
        <div
          style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, borderTop: '1px solid var(--border)' }}
          dangerouslySetInnerHTML={{ __html: renderInlineSafe(text) }}
        />
      )}
    </div>
  )
}
