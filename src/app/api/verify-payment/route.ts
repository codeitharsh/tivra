export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PLAN_SLUGS: Record<string, string[]> = {
  cloud_launchpad: ['cloud-launchpad'],
  cloud_architect: ['cloud-architect'],
  bundle:          ['cloud-launchpad', 'cloud-architect'],
}

// Web Crypto HMAC-SHA256 — works on Cloudflare edge (no Node.js needed)
async function hmacSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(req: Request): Promise<Response> {
  try {
    // ── STEP 1: Authenticate the caller. The session's user.id is the
    //    ONLY student_id this route will ever act on — never the request
    //    body. This closes the "activate someone else's account" hole. ──
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized — please log in again.' }, { status: 401 })
    }

    const body = await req.json() as {
      razorpay_order_id?:   string
      razorpay_payment_id?: string
      razorpay_signature?:  string
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    const keyId  = process.env.RAZORPAY_KEY_ID
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret || !keyId) {
      return Response.json({ error: 'Payment gateway not configured' }, { status: 500 })
    }

    // ── STEP 2: Verify HMAC signature ────────────────────────────
    const expected = await hmacSHA256(secret, `${razorpay_order_id}|${razorpay_payment_id}`)
    if (expected !== razorpay_signature) {
      console.error('[verify-payment] Signature mismatch for order', razorpay_order_id)
      return Response.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    const sb = adminSB()

    // ── STEP 3: Look up the order WE created and recorded server-side.
    //    This recovers the real student_id, plan, and amount — the
    //    client's claims about these are never trusted. If no matching
    //    pending order exists for this order_id AND this user, reject. ──
    const { data: orderRow, error: orderErr } = await sb
      .from('payment_requests')
      .select('id, student_id, plan, amount, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle()

    if (orderErr || !orderRow) {
      console.error('[verify-payment] No matching order record for', razorpay_order_id)
      return Response.json({ error: 'Order not found. Contact support with your payment ID.' }, { status: 404 })
    }

    const order = orderRow as { id: string; student_id: string; plan: string; amount: number; status: string }

    // The order must belong to the caller — prevents activating someone else's account
    if (order.student_id !== user.id) {
      console.error('[verify-payment] Order/user mismatch — possible tampering. order user:', order.student_id, 'caller:', user.id)
      return Response.json({ error: 'This payment does not belong to your account.' }, { status: 403 })
    }

    // ── STEP 4: Idempotency — reject if this order was already processed.
    //    Prevents replay of the same signature triple re-triggering
    //    duplicate activation/notifications. ──
    if (order.status === 'approved') {
      return Response.json({ success: true, activated: true, alreadyProcessed: true })
    }

    // ── STEP 5: Confirm with Razorpay's own API what was actually
    //    captured — never trust the client's claimed plan/amount.
    //    This closes the "pay for LaunchPad, claim Bundle" hole. ──
    const auth = btoa(`${keyId}:${secret}`)
    const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { 'Authorization': `Basic ${auth}` },
    })
    const paymentData = await paymentRes.json() as {
      status?: string; amount?: number; order_id?: string; error?: { description?: string }
    }

    if (!paymentRes.ok || !paymentData.status) {
      console.error('[verify-payment] Could not confirm payment with Razorpay:', paymentData.error?.description)
      return Response.json({ error: 'Could not confirm payment with payment gateway.' }, { status: 502 })
    }
    if (paymentData.status !== 'captured') {
      return Response.json({ error: `Payment not captured (status: ${paymentData.status})` }, { status: 400 })
    }
    if (paymentData.order_id !== razorpay_order_id) {
      console.error('[verify-payment] order_id mismatch between payment and claim')
      return Response.json({ error: 'Payment/order mismatch.' }, { status: 400 })
    }
    // amount stored in payment_requests is in rupees; Razorpay amount is paise
    if (paymentData.amount !== Math.round(order.amount * 100)) {
      console.error('[verify-payment] Amount mismatch — expected', order.amount * 100, 'got', paymentData.amount)
      return Response.json({ error: 'Payment amount does not match order.' }, { status: 400 })
    }

    // ── STEP 6: Everything verified — activate the account ──────
    const plan   = order.plan
    const amount = order.amount
    const slugs  = PLAN_SLUGS[plan] ?? ['cloud-launchpad']

    // Mark the order approved (idempotency guard for future replays)
    await sb.from('payment_requests').update({
      status:          'approved',
      transaction_ref: razorpay_payment_id,
      reviewed_at:     new Date().toISOString(),
      reviewed_by:     'razorpay_auto',
    }).eq('id', order.id)

    // Enrol in programme(s)
    for (const slug of slugs) {
      const { data: prog } = await sb
        .from('programs').select('id').eq('slug', slug).maybeSingle()
      if (prog) {
        await sb.from('enrolled_programs').upsert({
          student_id:        user.id,
          program_id:        (prog as { id: string }).id,
          plan:              'upfront',
          amount_paid:       amount,
          enrolled_at:       new Date().toISOString(),
          access_granted_at: new Date().toISOString(),
        }, { onConflict: 'student_id,program_id' })
      }
    }

    // Activate account
    // NOTE: payment_verified_by is a uuid column (references an admin's
    // profile id, presumably for manual approvals) — it cannot hold the
    // string 'razorpay_auto'. Previously this silently failed (the
    // update's error was never checked), meaning the account never
    // actually flipped to 'active' even though the route returned
    // success to the client. Leaving it NULL for auto-verified payments
    // since there's no admin to attribute it to.
    const { error: activateErr } = await sb.from('profiles').update({
      access_status:       'active',
      payment_verified_at: new Date().toISOString(),
      payment_verified_by: null,
    }).eq('id', user.id)

    if (activateErr) {
      console.error('[verify-payment] Account activation failed:', activateErr.message)
      return Response.json({
        error: 'Payment was verified but account activation failed. Contact support with your payment ID: ' + razorpay_payment_id,
      }, { status: 500 })
    }

    // Welcome notification
    await sb.from('notifications').insert({
      user_id: user.id,
      title:   '🎉 Payment confirmed — you\'re in!',
      body:    `₹${amount.toLocaleString('en-IN')} verified. Full access granted.`,
      type:    'success',
      link:    '/dashboard',
    })

    return Response.json({ success: true, activated: true })

  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
