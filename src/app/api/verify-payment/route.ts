export const runtime = 'nodejs'

import { createHmac } from 'crypto'
import { createClient as createSB } from '@supabase/supabase-js'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PLAN_AMOUNTS: Record<string, number>   = {
  cloud_launchpad: 6999,
  cloud_architect: 9999,
  bundle:          14999,
}
const PLAN_SLUGS: Record<string, string[]> = {
  cloud_launchpad: ['cloud-launchpad'],
  cloud_architect: ['cloud-architect'],
  bundle:          ['cloud-launchpad', 'cloud-architect'],
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as {
      razorpay_order_id?:   string
      razorpay_payment_id?: string
      razorpay_signature?:  string
      plan?:                string
      student_id?:          string
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan       = 'cloud_launchpad',
      student_id,
    } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    if (!student_id) {
      return Response.json({ error: 'Missing student_id' }, { status: 400 })
    }

    // ── Verify HMAC ──────────────────────────────────────────
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      return Response.json({ error: 'Payment gateway not configured' }, { status: 500 })
    }

    const expected = createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expected !== razorpay_signature) {
      console.error('[Razorpay] Signature mismatch')
      return Response.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // ── Activate account ─────────────────────────────────────
    const sb     = adminSB()
    const amount = PLAN_AMOUNTS[plan]  ?? 6999
    const slugs  = PLAN_SLUGS[plan]    ?? ['cloud-launchpad']

    // 1. Record payment
    await sb.from('payment_requests').insert({
      student_id,
      amount,
      payment_method:    'razorpay',
      transaction_ref:   razorpay_payment_id,
      razorpay_order_id,
      status:            'approved',
      reviewed_at:       new Date().toISOString(),
      reviewed_by:       'razorpay_auto',
      plan,
    })

    // 2. Enrol in programme(s)
    for (const slug of slugs) {
      const { data: prog } = await sb
        .from('programs').select('id').eq('slug', slug).maybeSingle()
      if (prog) {
        await sb.from('enrolled_programs').upsert({
          student_id,
          program_id:        (prog as { id: string }).id,
          plan:              'upfront',
          amount_paid:       amount,
          enrolled_at:       new Date().toISOString(),
          access_granted_at: new Date().toISOString(),
        }, { onConflict: 'student_id,program_id' })
      }
    }

    // 3. Activate
    await sb.from('profiles').update({
      access_status:       'active',
      payment_verified_at: new Date().toISOString(),
      payment_verified_by: 'razorpay_auto',
    }).eq('id', student_id)

    // 4. Notification
    await sb.from('notifications').insert({
      user_id: student_id,
      title:   '🎉 Payment confirmed — you\'re in!',
      body:    `₹${amount.toLocaleString('en-IN')} verified. Full access granted.`,
      type:    'success',
      link:    '/dashboard',
    }).select()

    return Response.json({ success: true, activated: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Razorpay] verify-payment error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
