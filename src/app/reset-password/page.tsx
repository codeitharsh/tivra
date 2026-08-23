'use client'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createRecoveryClient } from '@/lib/supabase/recovery-client'

type ExchangeState = 'exchanging' | 'ready' | 'invalid'

// No useSearchParams here (implicit flow reads the URL hash internally
// via the SDK, not a query param this component needs), so no Suspense
// boundary is required — unlike login/register/the old code-based
// version of this page.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [exchangeState, setExchangeState] = useState<ExchangeState>('exchanging')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, start] = useTransition()
  // Reused for both the recovery-session detection below AND the later
  // updateUser()/signOut() calls in handleSubmit — the implicit-flow
  // session that gets established here needs to be read by that same
  // client later, not a freshly constructed one.
  const [supabase] = useState(() => createRecoveryClient())

  // With the implicit flow, Supabase's client SDK automatically parses
  // the #access_token=...&type=recovery fragment in the URL on load
  // (detectSessionInUrl defaults to true) — no code to manually exchange,
  // nothing to look up in storage. It fires a PASSWORD_RECOVERY auth
  // event once that's done; getSession() covers the rare race where the
  // event fired before this listener attached. A link with no valid
  // token at all (or already used) never fires either, so a timeout is
  // what eventually resolves that case to "invalid" instead of hanging
  // on "Verifying…" forever.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setExchangeState('ready')
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setExchangeState('ready')
    })
    const timeout = setTimeout(() => {
      setExchangeState(prev => prev === 'exchanging' ? 'invalid' : prev)
    }, 4000)
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldError(null)
    const fd = new FormData(e.currentTarget)
    const password = fd.get('password') as string
    const confirm   = fd.get('confirm')  as string

    if (password.length < 8) { setFieldError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setFieldError('Passwords do not match.'); return }

    start(async () => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setError(error.message); return }
      // Sign out rather than leaving them logged in from the recovery
      // session — consistent with the rest of the app never auto-logging
      // a user in right after an account-state-changing action.
      await supabase.auth.signOut()
      router.push('/login?reset=success')
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
          {exchangeState === 'exchanging' && (
            <p style={{ fontSize:'14px', color:'var(--muted)', textAlign:'center' }}>Verifying your reset link…</p>
          )}

          {exchangeState === 'invalid' && (
            <>
              <h1 style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'22px', color:'var(--text)', marginBottom:'6px' }}>Link expired or invalid</h1>
              <p style={{ fontSize:'14px', color:'var(--muted)', marginBottom:'24px' }}>
                This password reset link has already been used or has expired. Request a new one below.
              </p>
              <Link href="/forgot-password" className="btn btn-primary" style={{ justifyContent:'center', width:'100%' }}>
                Request New Link
              </Link>
            </>
          )}

          {exchangeState === 'ready' && (
            <>
              <h1 style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'22px', color:'var(--text)', marginBottom:'6px' }}>Set a new password</h1>
              <p style={{ fontSize:'14px', color:'var(--muted)', marginBottom:'28px' }}>Choose a new password for your account</p>

              {error && (
                <div className="banner banner-warning" style={{ marginBottom:'20px' }}>{error}</div>
              )}

              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div>
                  <label className="form-label">New Password</label>
                  <div style={{ position:'relative' }}>
                    <input
                      name="password" type={showPassword ? 'text' : 'password'} required
                      placeholder="Min. 8 characters" className="form-input"
                      style={{ paddingRight:'44px' }}
                      onChange={() => setFieldError(null)}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', color:'var(--muted2)', cursor:'pointer',
                        display:'flex', padding:0,
                      }}
                    >
                      {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="form-label">Confirm Password</label>
                  <input
                    name="confirm" type={showPassword ? 'text' : 'password'} required
                    placeholder="Re-enter your password" className="form-input"
                    onChange={() => setFieldError(null)}
                  />
                  {fieldError && (
                    <p style={{ fontSize:'11px', color:'var(--red)', marginTop:'6px' }}>{fieldError}</p>
                  )}
                </div>
                <button type="submit" disabled={isPending} className="btn btn-primary" style={{ justifyContent:'center', marginTop:'4px', width:'100%', cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
                  {isPending ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
