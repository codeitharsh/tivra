import { createClient as createSB } from '@supabase/supabase-js'

// ════════════════════════════════════════════════════════════════
// TIVRA — Email Automation Infrastructure
//
// Design principles this module follows:
// 1. NEVER throws — every function returns a result object. A caller
//    (like registration) can fire-and-forget this without a try/catch
//    and never risk crashing or blocking the calling flow.
// 2. Every send attempt is logged to email_logs — success or failure,
//    with the actual error message, so failures are auditable and
//    can be manually or automatically retried later.
// 3. Retries with exponential backoff for transient failures (network
//    blips, provider rate limits) — but does NOT retry on permanent
//    failures (invalid email address, bad API key) since retrying
//    those just wastes time and quota.
// 4. Provider-agnostic interface — sendEmail() doesn't know or care
//    that Resend is the provider underneath. Swapping providers later
//    means changing one function, not every call site.
//
// Why Resend, specifically: this app runs on Cloudflare's Edge
// Runtime, which cannot open raw TCP sockets — so traditional SMTP
// (nodemailer, etc.) does not work here at all. Resend is a plain
// HTTPS API, which edge runtimes support natively via fetch().
// ════════════════════════════════════════════════════════════════

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text?: string
  emailType: string          // e.g. 'welcome', 'payment_confirmation' — used for logging/filtering
  userId?: string             // optional — links the log row to a profiles.id for auditing
  metadata?: Record<string, unknown>
}

export interface SendEmailResult {
  success: boolean
  logId?: string
  error?: string
  attempts: number
}

const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 500 // doubles each retry: 500ms, 1000ms, 2000ms

// Errors that indicate retrying will NEVER help — stop immediately
// instead of burning through the retry budget on a guaranteed failure.
function isPermanentFailure(status: number): boolean {
  // 400 = malformed request (bad email format, etc.)
  // 401/403 = bad/missing API key — a config problem, not transient
  // 422 = validation error from the provider (e.g. invalid recipient)
  return [400, 401, 403, 422].includes(status)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Core send function — this is what the rest of the app calls ────
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const sb = adminSB()

  // Create the log row FIRST, in 'pending' state — even if the process
  // crashes mid-send, there's a record that a send was attempted.
  const { data: logRow, error: logInsertError } = await sb
    .from('email_logs')
    .insert({
      recipient: input.to,
      email_type: input.emailType,
      subject: input.subject,
      status: 'pending',
      provider: 'resend',
      attempt_count: 0,
      metadata: input.metadata ?? {},
      user_id: input.userId ?? null,
    })
    .select('id')
    .single()

  if (logInsertError) {
    // Don't let a logging failure stop the actual email from sending —
    // but surface it clearly, since a broken email_logs table (e.g.
    // migration not run yet) means every send from here on is flying
    // blind with no audit trail.
    console.error('[email] Could not create email_logs row — sending will proceed unlogged:', logInsertError.message)
  }

  // If we can't even write the log row, something is fundamentally
  // wrong (DB down, migration not run). Don't let that block sending
  // the email — attempt it anyway, just without a log ID to update.
  const logId = (logRow as { id: string } | null)?.id

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const fromName = process.env.RESEND_FROM_NAME ?? 'Tivra'

  if (!apiKey || !fromEmail) {
    const errMsg = 'Email not configured — missing RESEND_API_KEY or RESEND_FROM_EMAIL environment variable.'
    console.error('[email]', errMsg)
    if (logId) {
      await sb.from('email_logs').update({
        status: 'failed', last_error: errMsg, attempt_count: 0,
      }).eq('id', logId)
    }
    return { success: false, error: errMsg, attempts: 0, logId }
  }

  let lastError = ''
  let attempts = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      })

      if (res.ok) {
        const data = await res.json() as { id: string }
        if (logId) {
          await sb.from('email_logs').update({
            status: 'sent',
            provider_id: data.id,
            attempt_count: attempt,
            sent_at: new Date().toISOString(),
          }).eq('id', logId)
        }
        console.log(`[email] Sent successfully: ${input.emailType} to ${input.to} (attempt ${attempt}/${MAX_ATTEMPTS})`)
        return { success: true, logId, attempts: attempt }
      }

      // Non-OK response — read the error body for logging
      const errorBody = await res.text().catch(() => '')
      lastError = `Resend API returned ${res.status}: ${errorBody}`.slice(0, 500)

      if (isPermanentFailure(res.status)) {
        console.error(`[email] Permanent failure, not retrying: ${lastError}`)
        break // exit the retry loop immediately — retrying won't help
      }

      console.warn(`[email] Attempt ${attempt}/${MAX_ATTEMPTS} failed (status ${res.status}), will retry: ${lastError}`)
    } catch (err) {
      // Network-level failure (fetch itself threw) — always transient,
      // always worth retrying up to the attempt limit.
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[email] Attempt ${attempt}/${MAX_ATTEMPTS} network error, will retry: ${lastError}`)
    }

    // Don't sleep after the final attempt — no point delaying the
    // function return just to immediately give up afterward.
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1))
    }
  }

  // Every attempt failed (or a permanent failure broke the loop early)
  console.error(`[email] Giving up after ${attempts} attempt(s): ${input.emailType} to ${input.to} — ${lastError}`)
  if (logId) {
    await sb.from('email_logs').update({
      status: 'failed',
      attempt_count: attempts,
      last_error: lastError,
    }).eq('id', logId)
  }

  return { success: false, error: lastError, attempts, logId }
}

// ── Fire-and-forget wrapper for use in request handlers ────────────
// Registration (and anything else calling this) should NEVER wait on
// email delivery or fail because of it. This wrapper swallows every
// possible error path so it is always safe to call without a
// try/catch at the call site.
//
// IMPORTANT — history of this function, for whoever reads this next:
// An earlier version of this tried to use Cloudflare's ctx.waitUntil()
// (via a dynamic `await import('@cloudflare/next-on-pages')`) to keep
// the request alive long enough for the email to send in the
// background after the response was returned. That approach caused
// registration to hang indefinitely on the real deployed Cloudflare
// environment — dynamic-importing that package at request time is not
// how it's designed to be used; its request-context mechanism is
// wired in by the next-on-pages BUILD process, not available to pull
// in dynamically at runtime. It worked in local tests (plain Node) but
// hung in production, which is worse than the original problem.
//
// The fix that follows works identically in every environment — local
// dev, tests, and real Cloudflare — because it uses no platform-
// specific API at all: a plain timeout race. sendEmail() is genuinely
// awaited, but only for up to EMAIL_SEND_BUDGET_MS. If it hasn't
// finished by then, this function returns anyway so registration is
// never blocked — the send may still complete in the background if
// the runtime happens to keep it alive, and either way email_logs
// will have the real outcome recorded once it does finish.
const EMAIL_SEND_BUDGET_MS = 4000

export async function sendEmailFireAndForget(input: SendEmailInput): Promise<void> {
  const sendPromise = sendEmail(input).catch(err => {
    // sendEmail() itself never throws (every path returns a result
    // object) — this .catch is a final safety net in case something
    // truly unexpected happens (e.g. adminSB() throws due to missing
    // env vars). Logged, never propagated.
    console.error('[email] Unexpected error in fire-and-forget send:', err)
  })

  const timeout = new Promise<void>(resolve => setTimeout(resolve, EMAIL_SEND_BUDGET_MS))

  // Whichever finishes first wins — if sendPromise finishes within
  // budget, great, we return right after. If it's still running after
  // EMAIL_SEND_BUDGET_MS, we stop waiting and let the caller continue;
  // the underlying send keeps running and will still log its real
  // outcome to email_logs whenever it does finish.
  await Promise.race([sendPromise, timeout])
}
