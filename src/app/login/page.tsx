'use client'
import { useState, useTransition, useMemo, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'

const ERROR_MESSAGES: Record<string, string> = {
  restricted: 'Your account access has been suspended. Please contact contact@tivra.in to resolve this.',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [submitError, setSubmitError] = useState<string|null>(null)
  const [isPending, start] = useTransition()

  // Picks up ?error=... set by proxy.ts middleware when it redirects a
  // restricted/blocked user back here (e.g. /login?error=restricted).
  // Previously this param was set in the URL but never read or
  // displayed — the page just showed a blank login form with no
  // explanation, so a restricted user who re-entered correct credentials
  // would silently bounce back here in a confusing loop with zero
  // feedback about why.
  //
  // Derived directly during render with useMemo rather than copied
  // into state via a useEffect — searchParams is already available
  // synchronously on first render, so pushing it into a separate
  // setState call inside an effect just causes an extra, unnecessary
  // render pass (React's react-hooks/set-state-in-effect rule flags
  // exactly this pattern). submitError stays as real local state since
  // it genuinely originates from a user action (form submission), not
  // from a value already available during render.
  const urlError = useMemo(() => {
    const code = searchParams.get('error')
    return code ? ERROR_MESSAGES[code] ?? null : null
  }, [searchParams])

  const error = submitError ?? urlError

  // Only ever redirect to a same-origin relative path after login — a
  // `next` value like `//evil.com` or `https://evil.com` must never be
  // followed, since it's attacker-controllable via the URL.
  const safeNext = useMemo(() => {
    const next = searchParams.get('next')
    if (!next) return null
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) return null
    return next
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitError(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      })
      const data = await res.json() as { error?: string; success?: boolean }
      if (data.error) { setSubmitError(data.error); return }
      router.push(safeNext ?? '/dashboard')
      router.refresh()
    })
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', marginBottom:'32px', justifyContent:'center' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={30} height={30}/>
          <span style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'19px', color:'var(--text)' }}>Tivra</span>
        </Link>

        <div className="card card-accent-top" style={{ padding:'32px' }}>
          <h1 style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'22px', color:'var(--text)', marginBottom:'6px' }}>Welcome back</h1>
          <p style={{ fontSize:'14px', color:'var(--muted)', marginBottom:'28px' }}>Sign in to your Tivra account</p>

          {error && (
            <div className="banner banner-warning" style={{ marginBottom:'20px' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label className="form-label">Email</label>
              <input name="email" type="email" required placeholder="you@example.com" className="form-input"/>
            </div>
            <div>
              <label className="form-label">Password</label>
              <input name="password" type="password" required placeholder="••••••••" className="form-input"/>
            </div>
            <button type="submit" disabled={isPending} className="btn btn-primary" style={{ justifyContent:'center', marginTop:'4px', width:'100%', cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'20px', fontSize:'13px', color:'var(--muted2)' }}>
            {ENROLLMENT_OPEN ? (
              <>Don&apos;t have an account?{' '}
                <Link
                  href={safeNext ? `/register?next=${encodeURIComponent(safeNext)}` : '/register'}
                  style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}
                >Enrol Now</Link>
              </>
            ) : 'Enrollments will start soon.'}
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
