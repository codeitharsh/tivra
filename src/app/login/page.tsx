'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()
  const [showPass, setShowPass]      = useState(false)
  const [error, setError]            = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await login(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(16px,4vw,24px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-100px', left: '50%',
        transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 0,
      }}>
        <svg width="700" height="300" viewBox="0 0 700 300" fill="none">
          <defs><filter id="lg"><feGaussianBlur stdDeviation="40"/></filter></defs>
          <ellipse cx="350" cy="150" rx="300" ry="100" fill="#3b5bdb" opacity="0.07" filter="url(#lg)"/>
          <ellipse cx="350" cy="150" rx="180" ry="60"  fill="#00c8f8" opacity="0.06" filter="url(#lg)"/>
        </svg>
      </div>

      <div className="grid-lines" style={{ position: 'fixed' }}>
        <div className="grid-line" style={{ left: '25%' }}/>
        <div className="grid-line" style={{ left: '50%' }}/>
        <div className="grid-line" style={{ left: '75%' }}/>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none',
          }}>
            <Image
              src="/tivra-logo.png"
              alt="Tivra"
              width={44} height={44}
              style={{ borderRadius: '11px', objectFit: 'cover' }}
            />
            <div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '20px',
                background: 'linear-gradient(135deg, #00c8f8, #7030d0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', letterSpacing: '0.06em',
              }}>
                TIVRA
              </div>
              <div style={{
                fontSize: '8px', color: 'var(--muted)',
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                Rise Beyond
              </div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="glass" style={{ padding: '32px' }}>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800,
            color: '#fff', marginBottom: '6px',
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '28px' }}>
            Sign in to continue your AWS journey
          </p>

          {error && (
            <div className="banner banner-warning" style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
              <span style={{ fontSize: '13px' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div>
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                className="form-input"
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" htmlFor="password" style={{ margin: 0 }}>Password</label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
              style={{ width: '100%', justifyContent: 'center', fontSize: '14px', padding: '13px' }}
            >
              {isPending
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }}/> Signing in…</>
                : <><ArrowRight size={15}/> Sign In</>
              }
            </button>
          </form>

          <div style={{
            marginTop: '24px', paddingTop: '20px',
            borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center',
          }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" style={{ color: '#00c8f8', textDecoration: 'none', fontWeight: 500 }}>
                Register now
              </Link>
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Admin?{' '}
              <span
                style={{ color: '#a78bfa', textDecoration: 'none', cursor: 'pointer' }}
                onClick={() => {
                  const emailInput = document.getElementById('email') as HTMLInputElement
                  if (emailInput) emailInput.focus()
                }}
              >
                Use your admin email to login
              </span>
            </p>
          </div>
        </div>

        {/* Info hint */}
        <div className="banner banner-info" style={{ marginTop: '16px', fontSize: '12px' }}>
          <span style={{ flexShrink: 0 }}>💡</span>
          <span>
            New here? Register and our team will activate your account after payment verification.
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
