'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string|null>(null)
  const [isPending, start] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const password = fd.get('password') as string
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    start(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password, full_name: fd.get('full_name'), phone: fd.get('phone') }),
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
              { name:'phone',     label:'Phone (optional)', type:'tel', placeholder:'+91 98765 43210' },
              { name:'password',  label:'Password',  type:'password', placeholder:'Min. 8 characters' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.5)', marginBottom:'6px', fontWeight:600, letterSpacing:'0.04em' }}>{f.label}</label>
                <input name={f.name} type={f.type} required={f.name !== 'phone'} placeholder={f.placeholder}
                  style={{ width:'100%', padding:'12px 16px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:'14px', outline:'none', boxSizing:'border-box' }}/>
              </div>
            ))}
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
