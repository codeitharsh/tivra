export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendEmailFireAndForget } from '@/lib/email'
import { renderCoursePurchaseConfirmationEmail } from '@/lib/email-templates/course-purchase-confirmation'
import { isRateLimited, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const VERIFY_PAYMENT_LIMIT = { windowMs: 10 * 60 * 1000, max: 20 }

// Web Crypto HMAC-SHA256 — works on Cloudflare edge, mirrors
// verify-payment/route.ts's helper (kept local rather than shared,
// same as that file is self-contained).
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

// Isolated from verify-payment/route.ts — this route only ever writes
// course_purchases for one specific course. It never touches
// profiles.access_status or enrolled_programs.
export async function POST(req: Request): Promise<Response> {
  try {
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

    if (isRateLimited(`verify-course-payment:${user.id}`, VERIFY_PAYMENT_LIMIT)) {
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

    // ── Verify HMAC signature ────────────────────────────────
    const expected = await hmacSHA256(secret, `${razorpay_order_id}|${razorpay_payment_id}`)
    if (expected !== razorpay_signature) {
      console.error('[verify-course-payment] Signature mismatch for order', razorpay_order_id)
      return Response.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    const sb = adminSB()

    // ── Look up the order WE created and recorded server-side ──
    const { data: orderRow } = await sb
      .from('course_payment_requests')
      .select('id, student_id, course_id, amount, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle()

    if (!orderRow) {
      console.error('[verify-course-payment] No matching order record for', razorpay_order_id)
      return Response.json({ error: 'Order not found. Contact support with your payment ID.' }, { status: 404 })
    }

    const order = orderRow as { id: string; student_id: string; course_id: string; amount: number; status: string }

    if (order.student_id !== user.id) {
      console.error('[verify-course-payment] Order/user mismatch — possible tampering. order user:', order.student_id, 'caller:', user.id)
      return Response.json({ error: 'This payment does not belong to your account.' }, { status: 403 })
    }

    // ── Idempotency ──────────────────────────────────────────
    if (order.status === 'approved') {
      return Response.json({ success: true, purchased: true, alreadyProcessed: true })
    }

    // ── Confirm with Razorpay's own API what was actually captured ──
    const auth = btoa(`${keyId}:${secret}`)
    const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { 'Authorization': `Basic ${auth}` },
    })
    const paymentData = await paymentRes.json() as {
      status?: string; amount?: number; order_id?: string; error?: { description?: string }
    }

    if (!paymentRes.ok || !paymentData.status) {
      console.error('[verify-course-payment] Could not confirm payment with Razorpay:', paymentData.error?.description)
      return Response.json({ error: 'Could not confirm payment with payment gateway.' }, { status: 502 })
    }
    if (paymentData.status !== 'captured') {
      return Response.json({ error: `Payment not captured (status: ${paymentData.status})` }, { status: 400 })
    }
    if (paymentData.order_id !== razorpay_order_id) {
      console.error('[verify-course-payment] order_id mismatch between payment and claim')
      return Response.json({ error: 'Payment/order mismatch.' }, { status: 400 })
    }
    if (paymentData.amount !== Math.round(order.amount * 100)) {
      console.error('[verify-course-payment] Amount mismatch — expected', order.amount * 100, 'got', paymentData.amount)
      return Response.json({ error: 'Payment amount does not match order.' }, { status: 400 })
    }

    // ── Everything verified — grant the course ──────────────
    const { data: courseRow } = await sb
      .from('courses').select('slug, title').eq('id', order.course_id).maybeSingle()
    const course = courseRow as { slug: string; title: string } | null

    await sb.from('course_payment_requests').update({
      status:      'approved',
      reviewed_at: new Date().toISOString(),
    }).eq('id', order.id)

    const { error: purchaseErr } = await sb.from('course_purchases').upsert({
      student_id:          user.id,
      course_id:           order.course_id,
      amount_paid:         order.amount,
      razorpay_payment_id: razorpay_payment_id,
    }, { onConflict: 'student_id,course_id' })

    if (purchaseErr) {
      console.error('[verify-course-payment] Grant failed:', purchaseErr.message)
      return Response.json({
        error: 'Payment was verified but access could not be granted. Contact support with your payment ID: ' + razorpay_payment_id,
      }, { status: 500 })
    }

    await sb.from('notifications').insert({
      user_id: user.id,
      title:   '🎉 Purchase confirmed!',
      body:    course ? `"${course.title}" is unlocked — start learning now.` : 'Your course is unlocked — start learning now.',
      type:    'success',
      link:    course ? `/courses/${course.slug}` : '/courses',
    })

    if (user.email && course) {
      const { data: profileRow } = await sb
        .from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const fullName = (profileRow as { full_name: string | null } | null)?.full_name ?? undefined

      const { subject, html, text } = renderCoursePurchaseConfirmationEmail({
        fullName, courseTitle: course.title, courseSlug: course.slug, amountPaid: order.amount,
      })
      await sendEmailFireAndForget({
        to: user.email, subject, html, text,
        emailType: 'course_purchase_confirmation', userId: user.id,
        metadata: { course_id: order.course_id, amount: order.amount },
      })
    }

    return Response.json({ success: true, purchased: true })

  } catch (err) {
    console.error('[verify-course-payment] Unexpected error:', err)
    return Response.json({ error: 'Could not verify payment. Please contact support with your payment ID.' }, { status: 500 })
  }
}
