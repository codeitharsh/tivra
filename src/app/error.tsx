'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error monitoring service when available
    console.error('[Tivra Error]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '28px',
          color: '#fff', marginBottom: '10px' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span style={{ display: 'block', marginTop: '8px', fontSize: '12px',
              fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={reset} style={{ fontSize: '14px' }}>
            Try Again
          </button>
          <Link href="/" className="btn btn-ghost" style={{ fontSize: '14px' }}>
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
