'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Loader2, Shield, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

// ── Plan config ───────────────────────────────────────────
const PLANS = [
  {
    id:       'cloud_launchpad',
    name:     'Cloud LaunchPad',
    subtitle: 'AWS Cloud Practitioner',
    duration: '2 months',
    price:    6999,
    modules:  11,
    color:    '#00d4ff',
    popular:  false,
    features: [
      '11 modules with live classes',
      'AWS Cloud Practitioner prep',
      'Weekly tests + assessments',
      'Study notes & recordings',
      'Doubt resolution',
      'Verified certificate',
    ],
  },
  {
    id:       'cloud_architect',
    name:     'Cloud Architect',
    subtitle: 'AWS Solutions Architect',
    duration: '4 months',
    price:    9999,
    modules:  12,
    color:    '#7c3aed',
    popular:  false,
    features: [
      '12 modules with live classes',
      'AWS Solutions Architect prep',
      'Weekly tests + assessments',
      'Study notes & recordings',
      'Doubt resolution',
      'Verified certificate',
    ],
  },
  {
    id:       'bundle',
    name:     'Full Bundle',
    subtitle: 'Cloud LaunchPad + Architect',
    duration: '6 months',
    price:    14999,
    modules:  23,
    color:    '#3b5bdb',
    popular:  true,
    features: [
      'All 23 modules across both programmes',
      'AWS Cloud Practitioner + SAA-C03',
      'Priority doubt resolution',
      'Study notes & all recordings',
      '2 verified certificates',
      'Best value — save ₹1,999',
    ],
  },
]

type PayState = 'idle' | 'creating' | 'open' | 'verifying' | 'done' | 'error'

export default function PaymentPage() {
  const router            = useRouter()
  const [selectedPlan, setSelectedPlan] = useState('cloud_launchpad')
  const [payState,    setPayState]      = useState<PayState>('idle')
  const [errorMsg,    setErrorMsg]      = useState<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [userId,      setUserId]        = useState<string | null>(null)
  const [userName,    setUserName]      = useState('')
  const [userEmail,   setUserEmail]     = useState('')

  // Load Razorpay script + fetch current user
  useEffect(() => {
    // Load Razorpay checkout.js
    if (document.getElementById('razorpay-script')) {
      setScriptLoaded(true)
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

  const plan = PLANS.find(p => p.id === selectedPlan)!

  async function handlePay() {
    if (!scriptLoaded) { setErrorMsg('Payment gateway not loaded yet. Try again.'); return }
    if (!userId) { setErrorMsg('Session expired. Please refresh the page.'); return }
    setErrorMsg(null)
    setPayState('creating')

    try {
      // Step 1: Create Razorpay order on backend
      const orderRes = await fetch('/api/create-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: selectedPlan }),
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
        theme:   { color: '#3b5bdb' },
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

  // ── Success screen ────────────────────────────────────────
  if (payState === 'done') {
    return (
      <div style={{
        minHeight: '100vh', background: '#07080c',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 0 32px rgba(34,197,94,0.2)',
          }}>
            <CheckCircle2 size={40} style={{ color: 'var(--green)' }}/>
          </div>
          <h1 style={{
            fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: '28px', color: '#fff', marginBottom: '10px',
          }}>
            Payment Successful! 🎉
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', lineHeight: 1.6 }}>
            Your account has been activated. You now have full access to{' '}
            <strong style={{ color: '#fff' }}>{plan.name}</strong>.
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '32px' }}>
            Welcome to Tivra — let&apos;s get started!
          </p>
          <button className="btn btn-primary"
            onClick={() => router.push('/dashboard')}
            style={{ fontSize: '15px', padding: '14px 36px', justifyContent: 'center', width: '100%' }}>
            Go to Dashboard →
          </button>
        </div>
      </div>
    )
  }

  // ── Main payment page ─────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#07080c', color: '#fff' }}>

      {/* Top bar */}
      <div style={{
        padding: '16px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32}
            />
          <span style={{
            fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '16px',
            letterSpacing: '0.08em',
            background: 'linear-gradient(135deg,#00d4ff,#7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>TIVRA</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          <Shield size={13} style={{ color: 'var(--green)' }}/>
          Secured by Razorpay
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: 'clamp(26px,4vw,40px)', color: '#fff',
            marginBottom: '10px', letterSpacing: '-0.02em' }}>
            Choose Your Programme
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.45)' }}>
            One-time payment · Instant access · No hidden fees
          </p>
        </div>

        {/* Plan selector */}
        <div className="r-grid-3" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '32px',
        }}>
          {PLANS.map(p => (
            <div key={p.id} onClick={() => setSelectedPlan(p.id)}
              style={{
                borderRadius: '16px', padding: '24px 20px',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                border: selectedPlan === p.id
                  ? `1.5px solid ${p.color}`
                  : '1.5px solid rgba(255,255,255,0.08)',
                background: selectedPlan === p.id
                  ? `linear-gradient(135deg,${p.color}12,${p.color}06)`
                  : 'rgba(255,255,255,0.025)',
                transition: 'all 0.2s',
              }}>

              {/* Popular badge */}
              {p.popular && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  background: 'linear-gradient(135deg,#00d4ff,#7c3aed)',
                  borderRadius: '20px', padding: '3px 10px',
                  fontSize: '10px', fontWeight: 700, color: '#fff', letterSpacing: '0.06em',
                }}>BEST VALUE</div>
              )}

              {/* Selected indicator */}
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', marginBottom: '14px',
                border: `2px solid ${selectedPlan === p.id ? p.color : 'rgba(255,255,255,0.2)'}`,
                background: selectedPlan === p.id ? p.color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selectedPlan === p.id && (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }}/>
                )}
              </div>

              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800,
                fontSize: '16px', color: '#fff', marginBottom: '3px' }}>
                {p.name}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '14px' }}>
                {p.subtitle} · {p.duration}
              </div>
              <div style={{
                fontFamily: 'Syne,sans-serif', fontWeight: 800,
                fontSize: '28px', color: p.color, lineHeight: 1,
              }}>
                ₹{p.price.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                {p.modules} modules
              </div>
            </div>
          ))}
        </div>

        {/* Selected plan detail */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px',
        }} className="r-grid-2">

          {/* Features */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px', padding: '24px',
          }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700,
              fontSize: '14px', marginBottom: '16px', color: plan.color }}>
              {plan.name} includes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start',
                  fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ color: plan.color, flexShrink: 0, marginTop: '1px' }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px', padding: '24px',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700,
              fontSize: '14px', marginBottom: '20px' }}>
              Order Summary
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: '14px', marginBottom: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{plan.name}</span>
              <span>₹{plan.price.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: '13px', marginBottom: '16px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Duration</span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{plan.duration}</span>
            </div>

            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '16px', marginBottom: '20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px' }}>
                Total
              </span>
              <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800,
                fontSize: '24px', color: plan.color }}>
                ₹{plan.price.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Pay button */}
            <button
              onClick={handlePay}
              disabled={payState === 'creating' || payState === 'verifying' || payState === 'open'}
              style={{
                width: '100%', padding: '14px', borderRadius: '100px', border: 'none',
                background: (payState === 'creating' || payState === 'verifying' || payState === 'open')
                  ? 'rgba(59,91,219,0.4)'
                  : 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                color: '#fff', cursor: (payState === 'creating' || payState === 'verifying') ? 'wait' : 'pointer',
                fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px',
                letterSpacing: '0.04em', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 24px rgba(59,91,219,0.35)',
                transition: 'all 0.2s',
              }}>
              {payState === 'creating'  && <><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> Creating order…</>}
              {payState === 'verifying' && <><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> Verifying payment…</>}
              {payState === 'open'      && <><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> Complete payment in popup…</>}
              {(payState === 'idle' || payState === 'error') && (
                <><Zap size={15}/> Pay ₹{plan.price.toLocaleString('en-IN')} Securely</>
              )}
            </button>

            {/* Error */}
            {errorMsg && (
              <div style={{
                marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: '12px', color: 'var(--red)', lineHeight: 1.5,
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Security note */}
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '6px',
              fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
              <Shield size={11} style={{ color: 'var(--green)' }}/>
              256-bit SSL · Secured by Razorpay
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            Accepted payment methods
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {['UPI', 'Debit Card', 'Credit Card', 'Net Banking', 'Wallets', 'EMI'].map(m => (
              <span key={m} style={{
                padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>{m}</span>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
          Questions?{' '}
          <a href="mailto:contact@tivra.in" style={{ color: 'rgba(0,212,255,0.5)', textDecoration: 'none' }}>
            contact@tivra.in
          </a>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
