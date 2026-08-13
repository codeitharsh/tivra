'use client'
import { useMemo, useState, Suspense, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Check, X } from 'lucide-react'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Same-origin-only guard as login/page.tsx — `next` is attacker
  // controllable via the URL, never follow an absolute/external one.
  const safeNext = useMemo(() => {
    const next = searchParams.get('next')
    if (!next) return null
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) return null
    return next
  }, [searchParams])
  const loginHref = safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'
  const [error, setError] = useState<string|null>(null)
  const [referralCode,    setReferralCode]    = useState('')
  const [referralStatus,  setReferralStatus]  = useState<'idle'|'checking'|'valid'|'invalid'>('idle')
  const [referralFaculty, setReferralFaculty] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState<string|null>(null)
  const [isPending, start] = useTransition()

  async function validateReferral(code: string) {
    if (!code.trim()) { setReferralStatus('idle'); setReferralFaculty(''); return }
    setReferralStatus('checking')
    try {
      const res  = await fetch('/api/validate-referral', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json() as { valid: boolean; faculty_name?: string }
      if (data.valid) { setReferralStatus('valid'); setReferralFaculty(data.faculty_name ?? '') }
      else { setReferralStatus('invalid'); setReferralFaculty('') }
    } catch { setReferralStatus('invalid'); setReferralFaculty('') }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const phone = fd.get('phone') as string
    if (!phone || phone.trim().length < 7) { setError('Phone number is required.'); return }
    const password = fd.get('password') as string
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    const cleanEmail = (fd.get('email') as string).trim()
    start(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail, password,
          full_name: fd.get('full_name'), phone: phone.trim(),
          referral_code: referralStatus === 'valid' ? referralCode.trim() : undefined,
        }),
      })
      const data = await res.json() as { error?: string; success?: boolean }
      if (data.error) { setError(data.error); return }
      setRegisteredEmail(cleanEmail) // shows the "check your email" confirmation screen
    })
  }

  if (registeredEmail) {
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
            We&apos;ve sent a verification link to
          </p>
          <p style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600, marginBottom: '20px' }}>
            {registeredEmail}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--muted2)', lineHeight: 1.7, marginBottom: '28px' }}>
            Click the link in that email to verify your account. Didn&apos;t get it? Check your spam folder — it can take a minute to arrive.
          </p>
          <button onClick={() => router.push(loginHref)} className="btn btn-primary">
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'420px' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', marginBottom:'32px', justifyContent:'center' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={30} height={30}/>
          <span style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'19px', color:'var(--text)' }}>Tivra</span>
        </Link>

        <div className="card card-accent-top" style={{ padding:'32px' }}>
          <h1 style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'22px', color:'var(--text)', marginBottom:'6px' }}>Create your account</h1>
          <p style={{ fontSize:'14px', color:'var(--muted)', marginBottom:'28px' }}>Join Tivra and start learning</p>

          {error && (
            <div className="banner banner-warning" style={{ marginBottom:'20px' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {[
              { name:'full_name', label:'Full Name', type:'text',     placeholder:'John Doe' },
              { name:'email',     label:'Email',     type:'email',    placeholder:'you@example.com' },
              { name:'phone',     label:'Phone Number',     type:'tel', placeholder:'+91 98765 43210' },
              { name:'password',  label:'Password',  type:'password', placeholder:'Min. 8 characters' },
            ].map(f => (
              <div key={f.name}>
                <label className="form-label">{f.label}</label>
                <input name={f.name} type={f.type} required={true} placeholder={f.placeholder} className="form-input"/>
              </div>
            ))}
            {/* Referral code — optional */}
            <div>
              <label className="form-label">
                Referral Code <span style={{ fontWeight:400, textTransform:'none', opacity:0.6 }}>(optional)</span>
              </label>
              {referralStatus !== 'valid' ? (
                <div style={{ display:'flex', gap:'8px' }}>
                  <input
                    value={referralCode}
                    onChange={e => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus('idle'); setReferralFaculty('') }}
                    onBlur={e => validateReferral(e.target.value)}
                    className="form-input"
                    style={{
                      flex:1,
                      borderColor: referralStatus==='invalid' ? 'var(--red)' : undefined,
                      letterSpacing:'0.04em',
                    }}
                  />
                  <button type="button" onClick={() => validateReferral(referralCode)}
                    disabled={!referralCode.trim() || referralStatus==='checking'}
                    className="btn btn-ghost" style={{ whiteSpace:'nowrap' }}>
                    {referralStatus==='checking' ? '…' : 'Apply'}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:'var(--radius-sm)', background:'var(--green-dim)', border:'1px solid rgba(74,222,128,0.25)' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--green)', fontWeight:600 }}><Check size={13}/> Code applied — {referralFaculty}</span>
                  <button type="button" onClick={() => { setReferralCode(''); setReferralStatus('idle'); setReferralFaculty('') }}
                    style={{ background:'none', border:'none', color:'var(--muted2)', cursor:'pointer', display:'flex' }}><X size={14}/></button>
                </div>
              )}
              {referralStatus==='invalid' && (
                <p style={{ fontSize:'11px', color:'var(--red)', marginTop:'4px' }}>Invalid or inactive referral code.</p>
              )}
            </div>

            <button type="submit" disabled={isPending} className="btn btn-primary" style={{ justifyContent:'center', marginTop:'4px', width:'100%', cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'20px', fontSize:'13px', color:'var(--muted2)' }}>
            Already have an account?{' '}
            <Link href={loginHref} style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm/>
    </Suspense>
  )
}
