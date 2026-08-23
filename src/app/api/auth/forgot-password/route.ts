export const runtime = 'edge'
import { isRateLimited, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

const FORGOT_PASSWORD_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 } // 5 attempts / 10 min

// Rate-limit gate only — the actual supabase.auth.resetPasswordForEmail()
// call happens client-side (see forgot-password/page.tsx). PKCE requires
// the code_verifier it generates to still be readable by the SAME storage
// context that later calls exchangeCodeForSession() on /reset-password;
// calling resetPasswordForEmail() here (server-side, cookie-bound) and
// exchanging the code there (browser client) split that across two
// storage contexts and Supabase couldn't find the verifier — confirmed
// via the exact error: "PKCE code verifier not found in storage." Keeping
// the whole PKCE lifecycle in the browser avoids that split entirely.
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

    return Response.json({ success: true })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
