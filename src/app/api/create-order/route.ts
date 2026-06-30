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

const PLANS: Record<string, { amount: number; label: string }> = {
  cloud_launchpad: { amount: 699900,  label: 'Cloud LaunchPad'             },
  cloud_architect: { amount: 999900,  label: 'Cloud Architect'             },
  bundle:          { amount: 1499900, label: 'Cloud LaunchPad + Architect' },
}

export async function POST(req: Request): Promise<Response> {
  try {
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

    const body = await req.json() as { plan?: string }
    const plan = body.plan ?? 'cloud_launchpad'

    if (!PLANS[plan]) {
      return Response.json({ error: `Invalid plan: ${plan}` }, { status: 400 })
    }

    const { amount, label } = PLANS[plan]

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
        notes: { plan, plan_label: label, student_id: user.id },
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
    const sb = adminSB()
    const { error: insertError } = await sb.from('payment_requests').insert({
      student_id:        user.id,
      amount:            amount / 100, // store in rupees, Razorpay amount is paise
      payment_method:    'razorpay',
      razorpay_order_id: data.id,
      status:            'pending',
      plan,
    })

    if (insertError) {
      console.error('[create-order] Failed to record pending order:', insertError.message)
      return Response.json({ error: 'Could not initialise payment. Please try again.' }, { status: 500 })
    }

    return Response.json({
      order_id:   data.id,
      amount:     data.amount,
      currency:   'INR',
      plan,
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
