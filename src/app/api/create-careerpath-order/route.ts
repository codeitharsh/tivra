export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isRateLimited, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CREATE_ORDER_LIMIT = { windowMs: 10 * 60 * 1000, max: 15 }

// Isolated the same way create-course-order/route.ts is isolated from
// programme checkout — a bundle purchase only ever grants
// career_path_purchases for one specific path. It never touches
// profiles.access_status, enrolled_programs, or course_purchases directly
// (course-level access is derived from this at read time, in
// hasPurchasedCourse — see src/lib/course-access.ts).
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

    if (isRateLimited(`create-careerpath-order:${user.id}`, CREATE_ORDER_LIMIT) || isRateLimited(`create-careerpath-order-ip:${getClientIp(req)}`, CREATE_ORDER_LIMIT)) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const body = await req.json() as { pathSlug?: string }
    const slug = body.pathSlug
    if (!slug) {
      return Response.json({ error: 'Missing pathSlug.' }, { status: 400 })
    }

    const sb = adminSB()
    const { data: pathRow } = await sb
      .from('career_paths')
      .select('id, title, price_inr')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (!pathRow) {
      return Response.json({ error: 'Career path not found.' }, { status: 404 })
    }

    const path = pathRow as { id: string; title: string; price_inr: number | null }
    if (!path.price_inr || path.price_inr <= 0) {
      return Response.json({ error: 'This career path is not purchasable.' }, { status: 400 })
    }

    const { data: existing } = await sb
      .from('career_path_purchases')
      .select('id')
      .eq('student_id', user.id)
      .eq('career_path_id', path.id)
      .maybeSingle()
    if (existing) {
      return Response.json({ error: 'You already own this career path.' }, { status: 409 })
    }

    const amount = path.price_inr * 100 // paise

    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return Response.json(
        { error: 'Payment not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables' },
        { status: 500 }
      )
    }

    const auth    = btoa(`${keyId}:${keySecret}`)
    const receipt = `tivra_path_${Date.now()}`

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
        notes: { career_path_id: path.id, career_path_slug: slug, student_id: user.id },
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

    const { error: insertError } = await sb.from('career_path_payment_requests').insert({
      student_id:        user.id,
      career_path_id:    path.id,
      amount:            amount / 100,
      razorpay_order_id: data.id,
      status:            'pending',
    })

    if (insertError) {
      console.error('[create-careerpath-order] Failed to record pending order:', insertError.message)
      return Response.json({ error: 'Could not initialise payment. Please try again.' }, { status: 500 })
    }

    return Response.json({
      order_id:  data.id,
      amount:    data.amount,
      currency:  'INR',
      path_slug: slug,
      path_title: path.title,
    })

  } catch (err) {
    console.error('[create-careerpath-order] Unexpected error:', err)
    return Response.json({ error: 'Could not initialise payment. Please try again or contact support.' }, { status: 500 })
  }
}
