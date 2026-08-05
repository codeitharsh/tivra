export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendEmailFireAndForget } from '@/lib/email'
import { renderEnrollmentConfirmationEmail } from '@/lib/email-templates/enrollment-confirmation'
import { isRateLimited, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Generous — legitimate retries after a network blip are expected —
// but still bounded so a forged/guessed signature can't be hammered.
const VERIFY_PAYMENT_LIMIT = { windowMs: 10 * 60 * 1000, max: 20 }

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

    if (isRateLimited(`verify-payment:${user.id}`, VERIFY_PAYMENT_LIMIT)) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
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
      .select('id, student_id, plan, program_id, amount, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle()

    if (orderErr || !orderRow) {
      console.error('[verify-payment] No matching order record for', razorpay_order_id)
      return Response.json({ error: 'Order not found. Contact support with your payment ID.' }, { status: 404 })
    }

    const order = orderRow as { id: string; student_id: string; plan: string; program_id: string | null; amount: number; status: string }

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

    // Prefer the program_id recorded at order-creation time (DB-driven,
    // works for any programme with zero per-programme code). Only orders
    // created before this column was populated fall back to resolving
    // by the plan string, tolerating the old underscore-style plan IDs.
    let programId = order.program_id
    if (!programId) {
      const legacySlug = plan.replace(/_/g, '-')
      const { data: legacyProg } = await sb
        .from('programs').select('id').eq('slug', legacySlug).maybeSingle()
      programId = (legacyProg as { id: string } | null)?.id ?? null
    }

    if (!programId) {
      console.error('[verify-payment] Could not resolve a programme for plan', plan)
      return Response.json({
        error: 'Could not determine which programme this payment is for. Contact support with your payment ID: ' + razorpay_payment_id,
      }, { status: 500 })
    }

    const { data: progRow } = await sb
      .from('programs').select('id, name').eq('id', programId).maybeSingle()
    const program = progRow as { id: string; name: string } | null

    // Mark the order approved (idempotency guard for future replays)
    await sb.from('payment_requests').update({
      status:          'approved',
      transaction_ref: razorpay_payment_id,
      reviewed_at:     new Date().toISOString(),
      reviewed_by:     'razorpay_auto',
    }).eq('id', order.id)

    // Enrol in the programme
    await sb.from('enrolled_programs').upsert({
      student_id:        user.id,
      program_id:        programId,
      plan:              'upfront',
      amount_paid:       amount,
      enrolled_at:       new Date().toISOString(),
      access_granted_at: new Date().toISOString(),
    }, { onConflict: 'student_id,program_id' })

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

    // Enrollment confirmation email — never fails the request even if sending fails
    const programName = program?.name ?? 'your programme'
    if (user.email) {
      const { data: profileRow } = await sb
        .from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const fullName = (profileRow as { full_name: string | null } | null)?.full_name ?? undefined

      const { subject, html, text } = renderEnrollmentConfirmationEmail({
        fullName,
        programName,
        amountPaid: amount,
      })
      // Awaited (not fire-and-forget from this call site) — on Cloudflare's
      // edge runtime the function can be torn down as soon as the handler
      // stops awaiting anything, which would silently kill the email send
      // partway through. See src/app/api/auth/register/route.ts for the
      // same pattern/reasoning.
      await sendEmailFireAndForget({
        to:        user.email,
        subject,
        html,
        text,
        emailType: 'enrollment_confirmation',
        userId:    user.id,
        metadata:  { program_id: programId, amount },
      })
    }

    return Response.json({ success: true, activated: true })

  } catch (err) {
    // Same fix as create-order — never return raw err.message to the
    // client for an unexpected failure in the payment-verification
    // path specifically; this is the highest-stakes route in the app
    // and the last place that should leak internal error detail.
    console.error('[verify-payment] Unexpected error:', err)
    return Response.json({ error: 'Could not verify payment. Please contact support with your payment ID.' }, { status: 500 })
  }
}
