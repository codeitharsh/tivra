'use client'
import { useState, useTransition, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'

const ERROR_MESSAGES: Record<string, string> = {
  restricted: 'Your account access has been suspended. Please contact contact@tivra.in to resolve this.',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string|null>(null)
  const [isPending, start] = useTransition()

  // Picks up ?error=... set by proxy.ts middleware when it redirects a
  // restricted/blocked user back here (e.g. /login?error=restricted).
  // Previously this param was set in the URL but never read or
  // displayed — the page just showed a blank login form with no
  // explanation, so a restricted user who re-entered correct credentials
  // would silently bounce back here in a confusing loop with zero
  // feedback about why.
  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError && ERROR_MESSAGES[urlError]) {
      setError(ERROR_MESSAGES[urlError])
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      })
      const data = await res.json() as { error?: string; success?: boolean }
      if (data.error) { setError(data.error); return }
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07080c', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', marginBottom:'32px', justifyContent:'center' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32} />
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'18px', letterSpacing:'0.1em', background:'linear-gradient(135deg,#00d4ff,#7c3aed)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>TIVRA</span>
        </Link>

        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px', padding:'32px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#00d4ff,#3b5bdb,#7c3aed)' }}/>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'22px', color:'#fff', marginBottom:'6px' }}>Welcome back</h1>
          <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.4)', marginBottom:'28px' }}>Sign in to your Tivra account</p>

          {error && (
            <div style={{ padding:'12px 16px', borderRadius:'10px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:'13px', marginBottom:'20px' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.5)', marginBottom:'6px', fontWeight:600, letterSpacing:'0.04em' }}>Email</label>
              <input name="email" type="email" required placeholder="you@example.com" style={{ width:'100%', padding:'12px 16px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.5)', marginBottom:'6px', fontWeight:600, letterSpacing:'0.04em' }}>Password</label>
              <input name="password" type="password" required placeholder="••••••••" style={{ width:'100%', padding:'12px 16px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }}/>
            </div>
            <button type="submit" disabled={isPending} style={{ padding:'13px', borderRadius:'100px', background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)', color:'#fff', border:'none', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'14px', cursor:isPending?'wait':'pointer', marginTop:'4px', opacity:isPending?0.7:1 }}>
              {isPending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'20px', fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color:'#00d4ff', textDecoration:'none', fontWeight:600 }}>Enrol Now</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm/>
    </Suspense>
  )
}
