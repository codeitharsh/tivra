'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string|null>(null)
  const [referralCode,    setReferralCode]    = useState('')
  const [referralStatus,  setReferralStatus]  = useState<'idle'|'checking'|'valid'|'invalid'>('idle')
  const [referralFaculty, setReferralFaculty] = useState('')
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
    start(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fd.get('email'), password,
          full_name: fd.get('full_name'), phone: phone.trim(),
          referral_code: referralStatus === 'valid' ? referralCode.trim() : undefined,
        }),
      })
      const data = await res.json() as { error?: string; success?: boolean }
      if (data.error) { setError(data.error); return }
      router.push('/pending')
      router.refresh()
    })
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07080c', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'420px' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', marginBottom:'32px', justifyContent:'center' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32} />
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'18px', letterSpacing:'0.1em', background:'linear-gradient(135deg,#00d4ff,#7c3aed)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>TIVRA</span>
        </Link>

        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px', padding:'32px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#00d4ff,#3b5bdb,#7c3aed)' }}/>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'22px', color:'#fff', marginBottom:'6px' }}>Create your account</h1>
          <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.4)', marginBottom:'28px' }}>Join Tivra and start learning</p>

          {error && (
            <div style={{ padding:'12px 16px', borderRadius:'10px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:'13px', marginBottom:'20px' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {[
              { name:'full_name', label:'Full Name', type:'text',     placeholder:'Harsh Sharma' },
              { name:'email',     label:'Email',     type:'email',    placeholder:'you@example.com' },
              { name:'phone',     label:'Phone Number',     type:'tel', placeholder:'+91 98765 43210' },
              { name:'password',  label:'Password',  type:'password', placeholder:'Min. 8 characters' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.5)', marginBottom:'6px', fontWeight:600, letterSpacing:'0.04em' }}>{f.label}</label>
                <input name={f.name} type={f.type} required={true} placeholder={f.placeholder}
                  style={{ width:'100%', padding:'12px 16px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }}/>
              </div>
            ))}
            {/* Referral code — optional */}
            <div>
              <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.5)', marginBottom:'6px', fontWeight:600, letterSpacing:'0.04em' }}>
                Referral Code <span style={{ fontWeight:400, opacity:0.6 }}>(optional)</span>
              </label>
              {referralStatus !== 'valid' ? (
                <div style={{ display:'flex', gap:'8px' }}>
                  <input
                    value={referralCode}
                    onChange={e => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus('idle'); setReferralFaculty('') }}
                    onBlur={e => validateReferral(e.target.value)}
                    placeholder="e.g. LAKSHIKA100"
                    style={{ flex:1, padding:'12px 16px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:`1px solid ${referralStatus==='invalid' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, color:'#fff', fontSize:'13px', outline:'none', letterSpacing:'0.04em', boxSizing:'border-box' as const }}
                  />
                  <button type="button" onClick={() => validateReferral(referralCode)}
                    disabled={!referralCode.trim() || referralStatus==='checking'}
                    style={{ padding:'12px 14px', borderRadius:'10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:'12px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' as const }}>
                    {referralStatus==='checking' ? '…' : 'Apply'}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:'10px', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)' }}>
                  <span style={{ fontSize:'12px', color:'#4ade80', fontWeight:600 }}>✓ Code applied — {referralFaculty}</span>
                  <button type="button" onClick={() => { setReferralCode(''); setReferralStatus('idle'); setReferralFaculty('') }}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:'14px' }}>✕</button>
                </div>
              )}
              {referralStatus==='invalid' && (
                <p style={{ fontSize:'11px', color:'#f87171', marginTop:'4px' }}>Invalid or inactive referral code.</p>
              )}
            </div>

            <button type="submit" disabled={isPending} style={{ padding:'13px', borderRadius:'100px', background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)', color:'#fff', border:'none', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'14px', cursor:isPending?'wait':'pointer', marginTop:'4px', opacity:isPending?0.7:1 }}>
              {isPending ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'20px', fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color:'#00d4ff', textDecoration:'none', fontWeight:600 }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
