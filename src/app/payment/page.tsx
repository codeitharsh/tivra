'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Loader2, Shield, Zap, Clock, Check, X, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'
import { PROGRAM_META, DEFAULT_PROGRAM_META } from '@/lib/program-meta'

// ── Razorpay type declaration ─────────────────────────────
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}
interface RazorpayOptions {
  key:          string
  amount:       number
  currency:     string
  name:         string
  description:  string
  image?:       string
  order_id:     string
  handler:      (res: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void
  prefill?:     { name?: string; email?: string; contact?: string }
  theme?:       { color?: string }
  modal?:       { ondismiss?: () => void }
}
interface RazorpayInstance { open(): void }

// ── Plan shape, populated from `programs` via /api/programs ────────
// No plan is ever hardcoded here — any active programme in the DB
// becomes payable the instant it exists, with zero code changes.
interface Plan {
  id:       string // = programs.slug
  name:     string
  subtitle: string
  duration: string
  price:    number
  color:    string
  features: string[]
}

interface ApiProgram {
  slug: string; name: string; tagline: string | null
  price_inr: number | null; duration_label: string | null
  learning_outcomes: string[]
}

const DEFAULT_FEATURES = [
  'Live weekly classes', 'Study notes & recordings', 'Weekly tests & assessments',
  'Doubt Corner support', 'Verified certificate',
]

type PayState = 'idle' | 'creating' | 'open' | 'verifying' | 'done' | 'error'

function PaymentForm() {
  const router            = useRouter()
  const searchParams      = useSearchParams()
  const [plans,       setPlans]         = useState<Plan[]>([])
  const [plansLoaded, setPlansLoaded]   = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [payState,    setPayState]      = useState<PayState>('idle')
  const [errorMsg,    setErrorMsg]      = useState<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [userId,      setUserId]        = useState<string | null>(null)
  const [userName,    setUserName]      = useState('')
  const [userEmail,   setUserEmail]     = useState('')
  // Referral code
  const [referralCode,   setReferralCode]   = useState('')
  const [referralStatus, setReferralStatus] = useState<'idle'|'checking'|'valid'|'invalid'>('idle')
  const [referralData,   setReferralData]   = useState<{ referral_id: string; faculty_name: string; discount: number } | null>(null)

  // Load available programmes from the DB
  useEffect(() => {
    fetch('/api/programs').then(r => r.json()).then(d => {
      const list: Plan[] = ((d.programs ?? []) as ApiProgram[]).map(p => ({
        id:       p.slug,
        name:     p.name,
        subtitle: p.tagline ?? '',
        duration: p.duration_label ?? '',
        price:    p.price_inr ?? 0,
        color:    (PROGRAM_META[p.slug] ?? DEFAULT_PROGRAM_META).color,
        features: p.learning_outcomes.length > 0 ? p.learning_outcomes : DEFAULT_FEATURES,
      }))
      setPlans(list)
      setPlansLoaded(true)
      const urlPlan = searchParams.get('plan')
      if (urlPlan && list.some(p => p.id === urlPlan)) setSelectedPlan(urlPlan)
      else if (list.length > 0) setSelectedPlan(list[0].id)
    }).catch(() => setPlansLoaded(true))
  }, [searchParams])

  // Load Razorpay script + fetch current user
  useEffect(() => {
    // Load Razorpay checkout.js. The "already loaded" branch previously
    // called setScriptLoaded(true) synchronously within the effect body
    // itself — React's react-hooks/set-state-in-effect rule flags this
    // because it can trigger an immediate extra render pass on mount.
    // queueMicrotask defers it by one tick, putting it on the same
    // footing as the onload/onerror callbacks below (which are already
    // correctly async) rather than firing inline during the effect.
    if (document.getElementById('razorpay-script')) {
      queueMicrotask(() => setScriptLoaded(true))
    } else {
      const script    = document.createElement('script')
      script.id       = 'razorpay-script'
      script.src      = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async    = true
      script.onload   = () => setScriptLoaded(true)
      script.onerror  = () => setErrorMsg('Failed to load payment gateway. Check your connection.')
      document.body.appendChild(script)
    }

    // Fetch authenticated user
    const sb = createClient()

    sb.auth.getUser().then(({ data: { user }, error }) => {
      if (error) console.error('[Payment] getUser error:', error.message)
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email ?? '')
        // Also fetch display name
        sb.from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            const p = data as { full_name?: string } | null
            if (p?.full_name) setUserName(p.full_name)
          })
      }
    })
  }, [])

  const plan = plans.find(p => p.id === selectedPlan)
  const discount      = referralData?.discount ?? 0
  const effectivePrice = Math.max(0, (plan?.price ?? 0) - discount)

  async function validateReferral() {
    const code = referralCode.trim()
    if (!code) return
    setReferralStatus('checking')
    try {
      const res  = await fetch('/api/validate-referral', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json() as { valid: boolean; referral_id?: string; faculty_name?: string; discount?: number; error?: string }
      if (data.valid && data.referral_id) {
        setReferralStatus('valid')
        setReferralData({ referral_id: data.referral_id, faculty_name: data.faculty_name!, discount: data.discount! })
      } else {
        setReferralStatus('invalid')
        setReferralData(null)
      }
    } catch {
      setReferralStatus('invalid')
      setReferralData(null)
    }
  }

  function clearReferral() {
    setReferralCode('')
    setReferralStatus('idle')
    setReferralData(null)
  }

  async function handlePay() {
    if (!plan) return
    if (!scriptLoaded) { setErrorMsg('Payment gateway not loaded yet. Try again.'); return }
    if (!userId) { setErrorMsg('Session expired. Please refresh the page.'); return }
    setErrorMsg(null)
    setPayState('creating')

    try {
      // Step 1: Create Razorpay order on backend
      const orderRes = await fetch('/api/create-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: selectedPlan, referral_code: referralData ? referralCode.trim() : undefined, referral_id: referralData?.referral_id }),
      })
      const orderData = await orderRes.json() as {
        error?: string; order_id?: string; amount?: number; currency?: string
      }

      if (!orderRes.ok || !orderData.order_id) {
        setErrorMsg(orderData.error ?? 'Could not initiate payment. Please try again.')
        setPayState('error')
        return
      }

      setPayState('open')

      // Step 2: Open Razorpay modal
      const rzp = new window.Razorpay({
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount:      orderData.amount!,
        currency:    orderData.currency ?? 'INR',
        name:        'Tivra',
        description: `${plan.name} — ${plan.subtitle}`,
        image:       '/tivra-logo-no-bg.png',
        order_id:    orderData.order_id,

        handler: async (response) => {
          // Step 3: Verify signature on backend
          setPayState('verifying')
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan:                selectedPlan,
                student_id:          userId,
              }),
            })
            const verifyData = await verifyRes.json() as {
              success?: boolean; activated?: boolean; warning?: string; error?: string
            }

            if (verifyData.success) {
              setPayState('done')
            } else {
              setErrorMsg(verifyData.error ?? 'Payment verification failed. Contact support.')
              setPayState('error')
            }
          } catch {
            setErrorMsg('Network error during verification. Contact support with your payment ID.')
            setPayState('error')
          }
        },

        prefill: { name: userName, email: userEmail },
        theme:   { color: '#4a3fe0' },
        modal: {
          ondismiss: () => {
            // User closed the modal without paying
            if (payState === 'open') setPayState('idle')
          },
        },
      })

      rzp.open()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPayState('error')
    }
  }

  // ── Enrollments closed ────────────────────────────────────
  if (!ENROLLMENT_OPEN) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: 'var(--radius)',
            background: 'var(--card2)', border: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', color: 'var(--muted)',
          }}>
            <Clock size={24}/>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif), serif', fontWeight: 600,
            fontSize: '24px', color: 'var(--text)', marginBottom: '10px',
          }}>
            Enrollments will start soon
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.7 }}>
            We&apos;re not accepting payments just yet. Check back soon.
          </p>
          <Link href="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    )
  }

  // ── Loading programmes ────────────────────────────────────
  if (!plansLoaded || !plan) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Loader2 size={24} style={{ color: 'var(--muted)', animation: 'spin 1s linear infinite' }}/>
      </div>
    )
  }

  // ── Success screen ────────────────────────────────────────
  if (payState === 'done') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '50%',
            background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <CheckCircle2 size={32} style={{ color: 'var(--green)' }}/>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif), serif', fontWeight: 600,
            fontSize: '28px', color: 'var(--text)', marginBottom: '10px',
          }}>
            Payment successful
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--muted)', marginBottom: '8px', lineHeight: 1.6 }}>
            Your account has been activated. You now have full access to{' '}
            <strong style={{ color: 'var(--text)' }}>{plan.name}</strong>.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--muted2)', marginBottom: '32px' }}>
            Welcome to Tivra — let&apos;s get started!
          </p>
          <button className="btn btn-primary"
            onClick={() => router.push('/dashboard')}
            style={{ justifyContent: 'center', width: '100%' }}>
            Go to Dashboard
          </button>

          {/* WhatsApp community */}
          <div style={{ textAlign:'left', marginTop:'16px' }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              gap:'12px', flexWrap:'wrap',
              background:'rgba(37,211,102,0.06)',
              border:'1px solid rgba(37,211,102,0.22)',
              borderRadius:'var(--radius)', padding:'16px 18px',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'36px', height:'36px', borderRadius:'50%', flexShrink:0, background:'#25d366', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'13px', color:'var(--text)' }}>Join our WhatsApp Community</div>
                  <div style={{ fontSize:'11px', color:'var(--muted2)', marginTop:'2px' }}>Updates, resources & community discussions.</div>
                </div>
              </div>
              <a href="https://chat.whatsapp.com/FrYS4BBduCmDFXKFohTijq?mode=gi_t" target="_blank" rel="noopener noreferrer"
                style={{ flexShrink:0, padding:'8px 16px', borderRadius:'var(--radius)', background:'#25d366', color:'#fff', fontFamily:'var(--font-sans), sans-serif', fontWeight:600, fontSize:'12px', textDecoration:'none', whiteSpace:'nowrap' }}>
                Join
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main payment page ─────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Top bar */}
      <div style={{
        padding: '16px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={28} height={28}/>
          <span style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '17px', color: 'var(--text)' }}>Tivra</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', color: 'var(--muted)' }}>
          <Shield size={13} style={{ color: 'var(--green)' }}/>
          Secured by Razorpay
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600,
            fontSize: 'clamp(1.7rem,4vw,2.6rem)', color: 'var(--text)',
            marginBottom: '10px', letterSpacing: '-0.02em' }}>
            Choose Your Programme
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)' }}>
            One-time payment · Instant access · No hidden fees
          </p>
        </div>

        {/* Plan selector */}
        <div className="r-grid-3" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '32px',
        }}>
          {plans.map(p => (
            <div key={p.id} onClick={() => setSelectedPlan(p.id)}
              className="tv-clip-sm"
              style={{
                borderRadius: 'var(--radius)', padding: '22px 18px', cursor: 'pointer',
                border: selectedPlan === p.id ? `1px solid ${p.color}` : '1px solid var(--border)',
                background: selectedPlan === p.id ? 'var(--card2)' : 'var(--card)',
                transition: 'all 0.15s ease',
              }}>

              {/* Selected indicator */}
              <div style={{
                width: '17px', height: '17px', borderRadius: '50%', marginBottom: '14px',
                border: `1.5px solid ${selectedPlan === p.id ? p.color : 'var(--border2)'}`,
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selectedPlan === p.id && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }}/>
                )}
              </div>

              <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600,
                fontSize: '16px', color: 'var(--text)', marginBottom: '3px' }}>
                {p.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', marginBottom: '14px' }}>
                {[p.subtitle, p.duration].filter(Boolean).join(' · ')}
              </div>
              <div style={{
                fontFamily: 'var(--font-serif), serif', fontWeight: 600,
                fontSize: '26px', color: 'var(--text)', lineHeight: 1,
              }}>
                {p.price ? `₹${p.price.toLocaleString('en-IN')}` : 'Revealing Soon'}
              </div>
            </div>
          ))}
        </div>

        {/* Selected plan detail */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px',
        }} className="r-grid-2">

          {/* Features */}
          <div className="card">
            <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600,
              fontSize: '15px', marginBottom: '16px', color: 'var(--text)' }}>
              {plan.name} includes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start',
                  fontSize: '13px', color: 'var(--muted)' }}>
                  <Check size={14} style={{ color: plan.color, flexShrink: 0, marginTop: '1px' }}/>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600,
              fontSize: '15px', marginBottom: '20px', color: 'var(--text)' }}>
              Order Summary
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: '14px', marginBottom: '10px' }}>
              <span style={{ color: 'var(--muted)' }}>{plan.name}</span>
              <span style={{ color: 'var(--text)' }}>₹{effectivePrice.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: '13px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--muted2)' }}>Duration</span>
              <span style={{ color: 'var(--muted)' }}>{plan.duration}</span>
            </div>

            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '16px', marginBottom: '20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                Total
              </span>
              <span style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600,
                fontSize: '24px', color: 'var(--text)' }}>
                ₹{effectivePrice.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Referral code */}
            <div style={{ marginBottom:'12px' }}>
              <label className="form-label">
                Referral Code <span style={{ fontWeight:400, textTransform:'none', opacity:0.6 }}>(optional)</span>
              </label>
              {referralStatus !== 'valid' ? (
                <div style={{ display:'flex', gap:'8px' }}>
                  <input
                    value={referralCode}
                    onChange={e => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus('idle'); setReferralData(null) }}
                    onKeyDown={e => e.key === 'Enter' && validateReferral()}
                    placeholder="e.g. LAKSHIKA100"
                    className="form-input"
                    style={{ flex:1, borderColor: referralStatus === 'invalid' ? 'var(--red)' : undefined, letterSpacing:'0.05em' }}
                  />
                  <button
                    onClick={validateReferral}
                    disabled={!referralCode.trim() || referralStatus === 'checking'}
                    className="btn btn-ghost" style={{ whiteSpace:'nowrap', opacity: !referralCode.trim() ? 0.5 : 1 }}>
                    {referralStatus === 'checking' ? 'Checking…' : 'Apply'}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:'var(--radius-sm)', background:'var(--green-dim)', border:'1px solid rgba(74,222,128,0.25)' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--green)', fontWeight:700 }}>
                      <Check size={13}/> Referral by {referralData!.faculty_name} — ₹{referralData!.discount} off applied
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--muted2)', marginTop:'2px' }}>
                      Code: <code style={{ letterSpacing:'0.05em' }}>{referralCode}</code>
                    </div>
                  </div>
                  <button onClick={clearReferral} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted2)', display:'flex' }}><X size={14}/></button>
                </div>
              )}
              {referralStatus === 'invalid' && (
                <div style={{ fontSize:'12px', color:'var(--red)', marginTop:'5px' }}>Invalid or inactive referral code.</div>
              )}
              {discount > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'var(--muted)', marginTop:'8px', padding:'8px 0', borderTop:'1px solid var(--border)' }}>
                  <span>Original price</span><span style={{ textDecoration:'line-through' }}>₹{plan.price.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* Pay button */}
            <button
              onClick={handlePay}
              disabled={payState === 'creating' || payState === 'verifying' || payState === 'open'}
              className="btn btn-primary"
              style={{
                width: '100%', justifyContent: 'center',
                opacity: (payState === 'creating' || payState === 'verifying' || payState === 'open') ? 0.6 : 1,
                cursor: (payState === 'creating' || payState === 'verifying') ? 'wait' : 'pointer',
              }}>
              {payState === 'creating'  && <><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> Creating order…</>}
              {payState === 'verifying' && <><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> Verifying payment…</>}
              {payState === 'open'      && <><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> Complete payment in popup…</>}
              {(payState === 'idle' || payState === 'error') && (
                <><Zap size={15}/> Pay ₹{effectivePrice.toLocaleString('en-IN')} Securely</>
              )}
            </button>

            {/* Error */}
            {errorMsg && (
              <div className="banner banner-warning" style={{ marginTop: '12px', marginBottom: 0, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }}/>
                {errorMsg}
              </div>
            )}

            {/* Security note */}
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '6px',
              fontSize: '11px', color: 'var(--muted2)' }}>
              <Shield size={11} style={{ color: 'var(--green)' }}/>
              256-bit SSL · Secured by Razorpay
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted2)', fontFamily: 'var(--font-mono), monospace',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            Accepted payment methods
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {['UPI', 'Debit Card', 'Credit Card', 'Net Banking', 'Wallets', 'EMI'].map(m => (
              <span key={m} style={{
                padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600,
                background: 'var(--card2)', color: 'var(--muted)',
                border: '1px solid var(--border)',
              }}>{m}</span>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted2)' }}>
          Questions?{' '}
          <a href="mailto:contact@tivra.in" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            contact@tivra.in
          </a>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={null}>
      <PaymentForm/>
    </Suspense>
  )
}
