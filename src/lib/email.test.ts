import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock Supabase client BEFORE importing the module under test ────
// email.ts calls createClient() from '@supabase/supabase-js' at module
// load time inside adminSB(), so the mock must be registered first.
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: (...args: unknown[]) => { mockInsert(...args); return { select: mockSelect } },
      update: (...args: unknown[]) => { mockUpdate(...args); return { eq: mockEq } },
    })),
  })),
}))

// Set required env vars before importing the module
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

import { sendEmail, sendEmailFireAndForget } from './email'

describe('sendEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.RESEND_API_KEY = 'test-api-key'
    process.env.RESEND_FROM_EMAIL = 'noreply@tivra.in'
    process.env.RESEND_FROM_NAME = 'Tivra'

    // Reset the Supabase mock chain for each test
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'log-row-id-123' }, error: null })
    mockEq.mockResolvedValue({ data: null, error: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns success:true and logs "sent" status on a successful send', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resend-msg-id-abc' }),
    }) as unknown as typeof fetch

    const result = await sendEmail({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(1)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
    // Confirm it updated the log row to 'sent'
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', provider_id: 'resend-msg-id-abc' })
    )
  })

  it('does NOT send if RESEND_API_KEY is missing — fails fast with a clear error', async () => {
    delete process.env.RESEND_API_KEY
    global.fetch = vi.fn() as unknown as typeof fetch

    const result = await sendEmail({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not configured')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('retries on a transient (5xx) failure up to MAX_ATTEMPTS', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }) as unknown as typeof fetch

    const result = await sendEmail({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(3) // MAX_ATTEMPTS
    expect(global.fetch).toHaveBeenCalledTimes(3)
  }, 15000) // allow time for the real backoff sleeps (500+1000ms)

  it('does NOT retry on a permanent failure (400) — stops after 1 attempt', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid recipient email address',
    }) as unknown as typeof fetch

    const result = await sendEmail({
      to: 'not-a-real-email',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on a network-level failure (fetch throws) then succeeds', async () => {
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount < 2) return Promise.reject(new Error('ECONNRESET'))
      return Promise.resolve({ ok: true, json: async () => ({ id: 'msg-retry-success' }) })
    }) as unknown as typeof fetch

    const result = await sendEmail({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(2)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 15000)

  it('logs the failure with the actual error message when all attempts fail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    }) as unknown as typeof fetch

    await sendEmail({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        last_error: expect.stringContaining('429'),
      })
    )
  }, 15000)

  it('includes userId and metadata in the initial log insert', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-id' }),
    }) as unknown as typeof fetch

    await sendEmail({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
      userId: 'user-uuid-456',
      metadata: { full_name: 'Test Student' },
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-uuid-456',
        metadata: { full_name: 'Test Student' },
        email_type: 'welcome',
      })
    )
  })
})

describe('sendEmailFireAndForget', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.RESEND_API_KEY = 'test-api-key'
    process.env.RESEND_FROM_EMAIL = 'noreply@tivra.in'
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'log-row-id' }, error: null })
    mockEq.mockResolvedValue({ data: null, error: null })
  })

  it('completes normally and resolves once the send finishes, well within the timeout budget', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ id: 'msg-id' }),
    }) as unknown as typeof fetch

    await expect(
      sendEmailFireAndForget({
        to: 'student@example.com',
        subject: 'Welcome!',
        html: '<p>Hi</p>',
        emailType: 'welcome',
      })
    ).resolves.not.toThrow()
  })

  it('gives up waiting after the timeout budget if the send is still in flight, without throwing', async () => {
    // This is the actual bug fix being verified: a previous version of
    // this function relied on Cloudflare's ctx.waitUntil(), which
    // required dynamically importing @cloudflare/next-on-pages at
    // request time — that import hung indefinitely on the real
    // deployed Cloudflare environment, freezing registration entirely.
    // The fix removes any platform-specific API and instead races the
    // real send against a plain timeout, so registration can NEVER
    // hang no matter how slow or stuck the email provider is.
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(() => { /* never resolves — simulates a stuck request */ })
    ) as unknown as typeof fetch

    const start = Date.now()
    await sendEmailFireAndForget({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })
    const elapsed = Date.now() - start

    // Must return at (approximately) the timeout budget, not hang forever.
    expect(elapsed).toBeLessThan(5000)
    expect(elapsed).toBeGreaterThanOrEqual(3900) // allow small timing slack
  }, 10000)

  it('waits for a normal-speed send to genuinely complete, since it easily fits the timeout budget', async () => {
    // Distinguishing this from the previous Cloudflare-teardown risk:
    // this implementation genuinely awaits the real send when it's
    // fast (the overwhelmingly common case for a healthy email
    // provider) — it only stops waiting if the send is abnormally
    // slow or stuck, per the timeout test above.
    let fetchResolved = false
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => {
        fetchResolved = true
        resolve({ ok: true, json: async () => ({ id: 'x' }) })
      }, 200))
    ) as unknown as typeof fetch

    await sendEmailFireAndForget({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    // 200ms comfortably fits within the 4-second budget, so the real
    // send genuinely finished — this is NOT a fire-and-hope pattern.
    expect(fetchResolved).toBe(true)
  })

  it('never throws even when the provider is completely unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed')) as unknown as typeof fetch

    await expect(
      sendEmailFireAndForget({
        to: 'student@example.com',
        subject: 'Welcome!',
        html: '<p>Hi</p>',
        emailType: 'welcome',
      })
    ).resolves.not.toThrow()
  })
})
