'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import { register } from '@/app/actions/auth'

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [showPass, setShowPass]      = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await register(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(16px,4vw,24px)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow */}
      <div style={{ position:'absolute', top:'-80px', left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:0 }}>
        <svg width="700" height="300" viewBox="0 0 700 300" fill="none">
          <defs><filter id="rg"><feGaussianBlur stdDeviation="40"/></filter></defs>
          <ellipse cx="350" cy="150" rx="300" ry="100" fill="#3b5bdb" opacity="0.07" filter="url(#rg)"/>
          <ellipse cx="350" cy="150" rx="180" ry="60"  fill="#00c8f8" opacity="0.06" filter="url(#rg)"/>
        </svg>
      </div>
      <div className="grid-lines" style={{ position:'fixed' }}>
        <div className="grid-line" style={{ left:'25%' }}/>
        <div className="grid-line" style={{ left:'50%' }}/>
        <div className="grid-line" style={{ left:'75%' }}/>
      </div>

      <div style={{ width:'100%', maxWidth:'420px', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:'12px', textDecoration:'none' }}>
            <Image src="/tivra-logo.png" alt="Tivra" width={44} height={44}
              style={{ borderRadius:'11px', objectFit:'cover' }}/>
            <div>
              <div style={{
                fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'20px',
                background:'linear-gradient(135deg,#00c8f8,#7030d0)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                backgroundClip:'text', letterSpacing:'0.06em',
              }}>TIVRA</div>
              <div style={{ fontSize:'8px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase' }}>
                Rise Beyond
              </div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="glass" style={{ padding:'32px' }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'22px', fontWeight:800, color:'#fff', marginBottom:'6px' }}>
            Create your account
          </h1>
          <p style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'24px' }}>
            Join Cloud LaunchPad and start your AWS journey
          </p>

          <div className="banner banner-info" style={{ marginBottom:'20px', fontSize:'12px' }}>
            <span style={{ flexShrink:0 }}>ℹ️</span>
            <span>After registering, our team will review and activate your account within 24 hours.</span>
          </div>

          {error && (
            <div className="banner banner-warning" style={{ marginBottom:'20px' }}>
              <span style={{ flexShrink:0, fontSize:'16px' }}>⚠️</span>
              <span style={{ fontSize:'13px' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

            {/* Full name */}
            <div>
              <label className="form-label" htmlFor="full_name">Full name</label>
              <input className="form-input" id="full_name" name="full_name"
                type="text" placeholder="Your full name" required autoComplete="name"/>
            </div>

            {/* Email */}
            <div>
              <label className="form-label" htmlFor="email">Email address</label>
              <input className="form-input" id="email" name="email"
                type="email" placeholder="you@example.com" required autoComplete="email"/>
            </div>

            {/* Phone */}
            <div>
              <label className="form-label" htmlFor="phone">Phone number</label>
              <input className="form-input" id="phone" name="phone"
                type="tel" placeholder="+91 98765 43210" autoComplete="tel"/>
            </div>

            {/* Password */}
            <div>
              <label className="form-label" htmlFor="password">Password</label>
              <div style={{ position:'relative' }}>
                <input className="form-input" id="password" name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  required minLength={8} autoComplete="new-password"
                  style={{ paddingRight:'44px' }}/>
                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                  position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer',
                  color:'var(--muted)', display:'flex', alignItems:'center',
                }}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {/* Terms */}
            <label style={{
              display:'flex', alignItems:'flex-start', gap:'10px',
              cursor:'pointer', fontSize:'12px', color:'var(--muted)',
            }}>
              <input type="checkbox" name="terms" required
                style={{ marginTop:'2px', accentColor:'#00c8f8', flexShrink:0 }}/>
              <span>
                I agree to the{' '}
                <Link href="/terms" style={{ color:'#00c8f8', textDecoration:'none' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" style={{ color:'#00c8f8', textDecoration:'none' }}>Privacy Policy</Link>
              </span>
            </label>

            <button type="submit" className="btn btn-primary" disabled={isPending}
              style={{ width:'100%', justifyContent:'center', fontSize:'14px', padding:'13px' }}>
              {isPending
                ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> Creating account…</>
                : <><ArrowRight size={15}/> Create Account</>
              }
            </button>
          </form>

          <div style={{
            marginTop:'20px', paddingTop:'18px',
            borderTop:'1px solid var(--border)', textAlign:'center',
          }}>
            <p style={{ fontSize:'13px', color:'var(--muted)' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color:'#00c8f8', textDecoration:'none', fontWeight:500 }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
