export const runtime = 'edge'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'

const LOGIN_LIMIT = { windowMs: 10 * 60 * 1000, max: 8 } // 8 attempts / 10 min

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, password } = await req.json() as { email: string; password: string }

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const ip = getClientIp(req)
    // Rate limit by IP AND by email — protects against both a single attacker
    // hammering one account and a distributed attempt against many accounts.
    if (isRateLimited(`login-ip:${ip}`, LOGIN_LIMIT) || isRateLimited(`login-email:${email.toLowerCase()}`, LOGIN_LIMIT)) {
      return Response.json({ error: 'Too many login attempts. Please try again in a few minutes.' }, { status: 429 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll(c) { c.forEach(({ name,value,options }) => cookieStore.set(name,value,options)) } } }
    )
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = error.message.includes('Invalid login') ? 'Incorrect email or password.' : error.message
      return Response.json({ error: msg }, { status: 400 })
    }

    // Credentials were correct — but check access_status before letting
    // the client treat this as a successful login. Previously a
    // restricted account would sign in fine here, get a session cookie,
    // and only get bounced by middleware AFTER the fact — landing back
    // on a blank login page with no explanation, since the login page
    // never displayed the redirect's error param either. That created a
    // silent, confusing loop: correct password, no visible error, no
    // dashboard access, repeat.
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles').select('access_status').eq('id', data.user.id).single()
      const status = (profile as { access_status: string } | null)?.access_status

      if (status === 'restricted') {
        await supabase.auth.signOut()
        return Response.json({
          error: 'Your account access has been suspended. Please contact contact@tivra.in to resolve this.',
        }, { status: 403 })
      }
    }

    return Response.json({ success: true })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
