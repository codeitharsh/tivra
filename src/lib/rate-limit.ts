// In-memory rate limiter, per edge isolate. This is intentionally the
// same mechanism already used by /api/auth/login and /api/auth/register
// (extracted here so every route shares one implementation instead of
// copy-pasting it) — it is NOT a distributed limiter. On Cloudflare's
// edge, each isolate/PoP keeps its own counters, so the effective global
// limit under distributed traffic is higher than the configured value.
// For a hard global cap, this would need to move to a shared store
// (Cloudflare KV/Durable Objects, Upstash Redis, etc.) — noted here
// rather than silently pretended away.

const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitOptions {
  windowMs: number
  max: number
}

/** Returns true if `key` has exceeded `max` hits within `windowMs`. */
export function isRateLimited(key: string, { windowMs, max }: RateLimitOptions): boolean {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > max
}

/** Best-effort client IP from Cloudflare/standard proxy headers. */
export function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown'
}

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again in a few minutes.'
