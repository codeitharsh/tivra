'use client'

import { useState } from 'react'

// Switches between OS/language variants of the same command without
// forcing the learner to scroll past code that doesn't apply to them —
// e.g. macOS/Ubuntu/Windows install commands in one compact block.
export default function TabsBlock({ tabs }: { tabs: { label: string; language: string; code: string }[] }) {
  const [active, setActive] = useState(0)
  const t = tabs[active]

  return (
    <div style={{ margin: '16px 0' }}>
      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
        {tabs.map((tab, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            background: active === i ? 'var(--bg)' : 'var(--card2)',
            color: active === i ? 'var(--text)' : 'var(--muted)',
            border: '1px solid var(--border)',
            borderBottom: active === i ? '1px solid var(--bg)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', marginBottom: '-1px',
            fontFamily: 'var(--font-sans)',
          }}>{tab.label}</button>
        ))}
      </div>
      {t && (
        <pre style={{
          margin: 0, padding: '16px', background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) var(--radius-sm)',
          overflowX: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono)', lineHeight: 1.6,
        }}>
          <code>{t.code}</code>
        </pre>
      )}
    </div>
  )
}
