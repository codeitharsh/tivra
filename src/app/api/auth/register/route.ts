export const runtime = 'edge'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ── Basic in-memory rate limit (per edge isolate). Not a substitute for a
//    shared store like Cloudflare KV/Durable Objects under heavy load, but
//    closes the "zero protection at all" gap for now. ──────────────────────
const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s-()]{7,16}$/

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, password, full_name, phone } = await req.json() as Record<string,string>

    // ── Basic rate limit by IP ─────────────────────────────────
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown'
    if (isRateLimited(`register:${ip}`)) {
      return Response.json({ error: 'Too many registration attempts. Please try again in a few minutes.' }, { status: 429 })
    }

    // ── Input validation ────────────────────────────────────────
    if (!email || !EMAIL_RE.test(email.trim())) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    if (!full_name || full_name.trim().length < 2 || full_name.trim().length > 100) {
      return Response.json({ error: 'Please enter a valid full name.' }, { status: 400 })
    }
    if (phone && !PHONE_RE.test(phone.trim())) {
      return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanName  = full_name.trim().slice(0, 100)
    const cleanPhone = phone?.trim().slice(0, 20) || null

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll(c) { c.forEach(({ name,value,options }) => cookieStore.set(name,value,options)) } } }
    )
    const sb = createSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail, password, options: { data: { full_name: cleanName } },
    })
    if (authError) {
      return Response.json({
        error: authError.message.includes('already')
          ? 'Email already registered. Please sign in.'
          : authError.message,
      }, { status: 400 })
    }
    if (!authData.user) return Response.json({ error: 'Could not create account.' }, { status: 500 })

    await sb.from('profiles').upsert({
      id: authData.user.id, email: cleanEmail, full_name: cleanName,
      phone: cleanPhone, role: 'student', access_status: 'pending_payment',
    }, { onConflict: 'id' })

    return Response.json({ success: true })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
