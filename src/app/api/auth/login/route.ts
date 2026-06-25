export const runtime = 'edge'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Basic in-memory rate limit (per edge isolate) — closes the
//    "fully open to brute force" gap. Supabase Auth has its own internal
//    throttling too, but this adds an app-level layer. ────────────────────
const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 8

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > MAX_ATTEMPTS
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, password } = await req.json() as { email: string; password: string }

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown'
    // Rate limit by IP AND by email — protects against both a single attacker
    // hammering one account and a distributed attempt against many accounts.
    if (isRateLimited(`login-ip:${ip}`) || isRateLimited(`login-email:${email.toLowerCase()}`)) {
      return Response.json({ error: 'Too many login attempts. Please try again in a few minutes.' }, { status: 429 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll(c) { c.forEach(({ name,value,options }) => cookieStore.set(name,value,options)) } } }
    )
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = error.message.includes('Invalid login') ? 'Incorrect email or password.' : error.message
      return Response.json({ error: msg }, { status: 400 })
    }
    return Response.json({ success: true })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
