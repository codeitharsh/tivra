'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import './globals.css'

// Only fires when the root layout itself (or error.tsx) throws — a much
// narrower case than error.tsx, which catches everything rendered under
// the layout. Must render its own <html>/<body> since it replaces the
// entire root layout when triggered, and must import globals.css itself
// since the (failed) layout is what normally makes it available.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Tivra Global Error]', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh', background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '440px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: 'var(--radius)', margin: '0 auto 20px',
              background: 'var(--card2)', border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)',
            }}>
              <AlertTriangle size={24}/>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '26px',
              color: 'var(--text)', marginBottom: '10px' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              An unexpected error occurred. Our team has been notified.
              {error.digest && (
                <span style={{ display: 'block', marginTop: '8px', fontSize: '12px',
                  fontFamily: 'var(--font-mono), monospace', color: 'var(--muted2)' }}>
                  Error ID: {error.digest}
                </span>
              )}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={reset}>Try Again</button>
              <Link href="/" className="btn btn-ghost">Go Home</Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
