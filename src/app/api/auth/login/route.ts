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
        .from('profiles').select('access_status, last_login_date, streak_count').eq('id', data.user.id).single()
      const p = profile as { access_status: string; last_login_date: string | null; streak_count: number | null } | null

      if (p?.access_status === 'restricted') {
        await supabase.auth.signOut()
        return Response.json({
          error: 'Your account access has been suspended. Please contact contact@tivra.in to resolve this.',
        }, { status: 403 })
      }

      // ── Last login + daily streak ─────────────────────────────
      // Both columns existed in the schema and were displayed all
      // over the app (admin student list, profile page, dashboard)
      // but nothing anywhere ever actually wrote to them — every
      // account showed "Never" and a streak of 0 forever. Comparing
      // calendar dates in UTC (last_login_date is a plain `date`
      // column, no time component) — a login already recorded today
      // is a no-op, yesterday extends the streak, anything older
      // resets it to 1.
      const toDateOnly = (d: Date) => d.toISOString().slice(0, 10)
      const todayStr = toDateOnly(new Date())
      if (p && p.last_login_date !== todayStr) {
        const yesterdayStr = toDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000))
        const newStreak = p.last_login_date === yesterdayStr ? (p.streak_count ?? 0) + 1 : 1
        await supabase.from('profiles').update({
          last_login_date: todayStr, streak_count: newStreak,
        }).eq('id', data.user.id)
      }
    }

    return Response.json({ success: true })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
