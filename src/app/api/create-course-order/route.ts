export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isRateLimited, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'
import { hasPurchasedCourse } from '@/lib/course-access'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CREATE_ORDER_LIMIT = { windowMs: 10 * 60 * 1000, max: 15 }

// Isolated from create-order/route.ts on purpose — see
// migrations/2026-09-15-paid-courses.sql's comment. A course purchase
// must never touch programs/enrolled_programs/profiles.access_status;
// it only ever grants course_purchases for one specific course.
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

    if (isRateLimited(`create-course-order:${user.id}`, CREATE_ORDER_LIMIT) || isRateLimited(`create-course-order-ip:${getClientIp(req)}`, CREATE_ORDER_LIMIT)) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const body = await req.json() as { courseSlug?: string }
    const slug = body.courseSlug
    if (!slug) {
      return Response.json({ error: 'Missing courseSlug.' }, { status: 400 })
    }

    // Price comes from the courses table — the single source of truth.
    // A course with no price (or price 0) can never be purchased through
    // this route, closing off "buy" attempts on free courses.
    const sb = adminSB()
    const { data: courseRow } = await sb
      .from('courses')
      .select('id, title, price_inr')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (!courseRow) {
      return Response.json({ error: 'Course not found.' }, { status: 404 })
    }

    const course = courseRow as { id: string; title: string; price_inr: number | null }
    if (!course.price_inr || course.price_inr <= 0) {
      return Response.json({ error: 'This course is not purchasable.' }, { status: 400 })
    }

    if (await hasPurchasedCourse(sb, user.id, course.id)) {
      return Response.json({ error: 'You already own this course.' }, { status: 409 })
    }

    const amount = course.price_inr * 100 // paise

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
    const receipt = `tivra_course_${Date.now()}`

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
        notes: { course_id: course.id, course_slug: slug, student_id: user.id },
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

    // Recorded server-side before the client ever sees it —
    // verify-course-payment looks this up by order_id to recover the
    // real student_id/course_id/amount, never trusting the client's
    // later claims about them.
    const { error: insertError } = await sb.from('course_payment_requests').insert({
      student_id:        user.id,
      course_id:         course.id,
      amount:            amount / 100,
      razorpay_order_id: data.id,
      status:            'pending',
    })

    if (insertError) {
      console.error('[create-course-order] Failed to record pending order:', insertError.message)
      return Response.json({ error: 'Could not initialise payment. Please try again.' }, { status: 500 })
    }

    return Response.json({
      order_id:    data.id,
      amount:      data.amount,
      currency:    'INR',
      course_slug: slug,
      course_title: course.title,
    })

  } catch (err) {
    // Never return raw err.message for an unexpected failure on a
    // payment route — logged server-side, generic message to the client.
    console.error('[create-course-order] Unexpected error:', err)
    return Response.json({ error: 'Could not initialise payment. Please try again or contact support.' }, { status: 500 })
  }
}
