export const runtime = 'edge'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isRateLimited, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

const FORGOT_PASSWORD_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 } // 5 attempts / 10 min

export async function POST(req: Request): Promise<Response> {
  try {
    const { email } = await req.json() as { email: string }

    if (!email) {
      return Response.json({ error: 'Email is required.' }, { status: 400 })
    }

    const ip = getClientIp(req)
    if (isRateLimited(`forgot-password-ip:${ip}`, FORGOT_PASSWORD_LIMIT) ||
        isRateLimited(`forgot-password-email:${email.toLowerCase()}`, FORGOT_PASSWORD_LIMIT)) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll(c) { c.forEach(({ name,value,options }) => cookieStore.set(name,value,options)) } } }
    )

    // Always report success regardless of whether Supabase actually finds
    // an account for this email — surfacing "no account with that email"
    // would let an attacker enumerate registered addresses. The reset
    // email (if any) is sent by Supabase's own auth email service, not
    // this app's Resend integration.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    return Response.json({ success: true })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
