'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShoppingCart, AlertTriangle, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import '@/types/razorpay'

// Same Razorpay checkout.js flow as src/app/payment/page.tsx's
// handlePay, adapted into a compact inline buy button rather than a
// full page — see create-course-order/verify-course-payment for why
// this is a separate, isolated payment path from programme checkout.

type PayState = 'idle' | 'creating' | 'open' | 'verifying' | 'done' | 'error'

interface Props {
  courseSlug: string
  courseTitle: string
  priceInr: number
  originalPriceInr: number | null
}

export default function CourseCheckout({ courseSlug, courseTitle, priceInr, originalPriceInr }: Props) {
  const router = useRouter()
  const [payState, setPayState]     = useState<PayState>('idle')
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [userName, setUserName]     = useState('')
  const [userEmail, setUserEmail]   = useState('')

  useEffect(() => {
    if (document.getElementById('razorpay-script')) {
      queueMicrotask(() => setScriptLoaded(true))
    } else {
      const script   = document.createElement('script')
      script.id      = 'razorpay-script'
      script.src     = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async   = true
      script.onload  = () => setScriptLoaded(true)
      script.onerror = () => setErrorMsg('Failed to load payment gateway. Check your connection.')
      document.body.appendChild(script)
    }

    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? '')
      sb.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => setUserName((data as { full_name: string | null } | null)?.full_name ?? ''))
    })
  }, [])

  async function handlePay() {
    if (!scriptLoaded) { setErrorMsg('Payment gateway not loaded yet. Try again.'); return }
    setErrorMsg(null)
    setPayState('creating')

    try {
      const orderRes = await fetch('/api/create-course-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ courseSlug }),
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

      const rzp = new window.Razorpay({
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount:      orderData.amount!,
        currency:    orderData.currency ?? 'INR',
        name:        'Tivra',
        description: courseTitle,
        image:       '/tivra-logo-no-bg.png',
        order_id:    orderData.order_id,

        handler: async (response) => {
          setPayState('verifying')
          try {
            const verifyRes = await fetch('/api/verify-course-payment', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
              }),
            })
            const verifyData = await verifyRes.json() as { success?: boolean; error?: string }

            if (verifyData.success) {
              setPayState('done')
              router.refresh()
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

  if (payState === 'done') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>
        <Check size={15}/> Purchased — refreshing…
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
        {originalPriceInr && originalPriceInr > priceInr && (
          <span style={{ fontSize: '15px', color: 'var(--muted2)', textDecoration: 'line-through' }}>
            ₹{originalPriceInr.toLocaleString('en-IN')}
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '24px', color: 'var(--text)' }}>
          ₹{priceInr.toLocaleString('en-IN')}
        </span>
        {originalPriceInr && originalPriceInr > priceInr && (
          <span className="pill" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
            {Math.round((1 - priceInr / originalPriceInr) * 100)}% off
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="banner banner-warning" style={{ marginBottom: '12px' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }}/><span style={{ fontSize: '13px' }}>{errorMsg}</span>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handlePay}
        disabled={payState === 'creating' || payState === 'open' || payState === 'verifying'}
        style={{ fontSize: '13px' }}>
        {payState === 'creating' || payState === 'open'
          ? <><Loader2 size={14} className="spin"/> Opening checkout…</>
          : payState === 'verifying'
          ? <><Loader2 size={14} className="spin"/> Verifying payment…</>
          : <><ShoppingCart size={14}/> Buy for ₹{priceInr.toLocaleString('en-IN')}</>}
      </button>
    </div>
  )
}
