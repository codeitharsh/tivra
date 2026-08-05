export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'
import { isRateLimited, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CREATE_ORDER_LIMIT = { windowMs: 10 * 60 * 1000, max: 15 }

export async function POST(req: Request): Promise<Response> {
  try {
    if (!ENROLLMENT_OPEN) {
      return Response.json({ error: 'Enrollments will start soon.' }, { status: 403 })
    }

    // ── Authenticate the caller — the order is tied to THIS verified
    //    session's user, never to a client-supplied ID. This is the
    //    record that verify-payment will later trust, not the client. ──
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

    if (isRateLimited(`create-order:${user.id}`, CREATE_ORDER_LIMIT) || isRateLimited(`create-order-ip:${getClientIp(req)}`, CREATE_ORDER_LIMIT)) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const body = await req.json() as { plan?: string; referral_code?: string; referral_id?: string }
    const slug         = body.plan
    const referralId   = body.referral_id ?? null
    const referralCode = body.referral_code?.toUpperCase().trim() ?? null

    if (!slug) {
      return Response.json({ error: 'Missing plan.' }, { status: 400 })
    }

    // ── Price/label come from the `programs` table — the single source
    //    of truth for pricing. No per-programme map here: a new
    //    programme becomes payable the instant its row is active. ──
    const sb = adminSB()
    const { data: programRow } = await sb
      .from('programs')
      .select('id, name, price_inr')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (!programRow) {
      return Response.json({ error: `Invalid or inactive plan: ${slug}` }, { status: 400 })
    }

    const program = programRow as { id: string; name: string; price_inr: number | null }
    if (!program.price_inr) {
      return Response.json({ error: `Pricing not yet available for ${program.name}.` }, { status: 400 })
    }

    const amount = program.price_inr * 100 // paise
    const label  = program.name

    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return Response.json(
        { error: 'Payment not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables' },
        { status: 500 }
      )
    }

    // btoa works on edge runtime (Cloudflare) — Buffer is Node.js only
    const auth    = btoa(`${keyId}:${keySecret}`)
    const receipt = `tivra_${Date.now()}`

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt,
        notes: { plan: slug, plan_label: label, student_id: user.id },
      }),
    })

    const data = await rzpRes.json() as {
      id?:     string
      amount?: number
      error?:  { description?: string }
    }

    if (!rzpRes.ok || !data.id) {
      const msg = data.error?.description ?? `Razorpay error (HTTP ${rzpRes.status})`
      return Response.json({ error: msg }, { status: 502 })
    }

    // ── Record the order server-side BEFORE the client ever sees it.
    //    verify-payment will look this row up by order_id to recover
    //    the real student_id/plan/amount — the client's later claims
    //    about who/what are never trusted directly. ──
    const { error: insertError } = await sb.from('payment_requests').insert({
      student_id:        user.id,
      program_id:        program.id,
      amount:            amount / 100,
      payment_method:    'razorpay',
      razorpay_order_id: data.id,
      status:            'pending',
      plan:              slug,
      referral_code:     referralCode,
      referral_id:       referralId,
      discount_amount:   null, // actual discount stored via referral_id → faculty_referrals.discount_amount
    })

    if (insertError) {
      console.error('[create-order] Failed to record pending order:', insertError.message)
      return Response.json({ error: 'Could not initialise payment. Please try again.' }, { status: 500 })
    }

    return Response.json({
      order_id:   data.id,
      amount:     data.amount,
      currency:   'INR',
      plan:       slug,
      plan_label: label,
    })

  } catch (err) {
    // Previously returned err.message directly to the client — this
    // can leak internal details (library error strings, stack traces,
    // occasionally even partial connection info) in an unexpected
    // failure. Logged server-side for real debugging; client gets a
    // generic, safe message.
    console.error('[create-order] Unexpected error:', err)
    return Response.json({ error: 'Could not initialise payment. Please try again or contact support.' }, { status: 500 })
  }
}
