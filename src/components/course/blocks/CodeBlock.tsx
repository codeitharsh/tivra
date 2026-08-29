'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail silently,
      // copying is a convenience, not a required affordance.
    }
  }

  return (
    <div style={{ margin: '16px 0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 8px 6px 14px', background: 'var(--card2)', border: '1px solid var(--border)',
        borderBottom: 'none', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
      }}>
        <span style={{
          fontSize: '11px', color: 'var(--muted2)', fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{language || 'code'}</span>
        <button onClick={handleCopy} style={{
          display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none',
          cursor: 'pointer', color: copied ? 'var(--green)' : 'var(--muted)', fontSize: '11px',
          padding: '4px 6px', fontFamily: 'var(--font-sans)',
        }}>
          {copied ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: '16px', background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
        overflowX: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono)', lineHeight: 1.6,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}
