'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const email = (fd.get('email') as string).trim()
    start(async () => {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json() as { error?: string; success?: boolean }
      if (data.error) { setError(data.error); return }
      setSentTo(email)
    })
  }

  if (sentTo) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)', padding: '24px',
      }}>
        <div className="card card-accent-top" style={{
          maxWidth: '440px', width: '100%', textAlign: 'center', padding: '44px 36px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: 'var(--radius)',
            background: 'var(--card2)', border: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', color: 'var(--muted)',
          }}>
            <Mail size={24}/>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '22px',
            color: 'var(--text)', marginBottom: '12px',
          }}>
            Check your email
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '8px' }}>
            If an account exists for
          </p>
          <p style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600, marginBottom: '20px' }}>
            {sentTo}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--muted2)', lineHeight: 1.7, marginBottom: '28px' }}>
            we&apos;ve sent a link to reset your password. Didn&apos;t get it? Check your spam folder — it can take a minute to arrive.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', marginBottom:'32px', justifyContent:'center' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={30} height={30}/>
          <span style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'19px', color:'var(--text)' }}>Tivra</span>
        </Link>

        <div className="card card-accent-top" style={{ padding:'32px' }}>
          <h1 style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'22px', color:'var(--text)', marginBottom:'6px' }}>Reset your password</h1>
          <p style={{ fontSize:'14px', color:'var(--muted)', marginBottom:'28px' }}>Enter your email and we&apos;ll send you a reset link</p>

          {error && (
            <div className="banner banner-warning" style={{ marginBottom:'20px' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label className="form-label">Email</label>
              <input name="email" type="email" required placeholder="you@example.com" className="form-input"/>
            </div>
            <button type="submit" disabled={isPending} className="btn btn-primary" style={{ justifyContent:'center', marginTop:'4px', width:'100%', cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'20px', fontSize:'13px', color:'var(--muted2)' }}>
            Remembered your password?{' '}
            <Link href="/login" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
