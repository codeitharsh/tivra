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

  it('returns immediately without waiting for the send to complete', () => {
    let resolved = false
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => {
        resolved = true
        resolve({ ok: true, json: async () => ({ id: 'x' }) })
      }, 100))
    ) as unknown as typeof fetch

    sendEmailFireAndForget({
      to: 'student@example.com',
      subject: 'Welcome!',
      html: '<p>Hi</p>',
      emailType: 'welcome',
    })

    // The function call itself returns synchronously — the send
    // hasn't had time to resolve yet. This is the core guarantee:
    // registration can call this and move on immediately.
    expect(resolved).toBe(false)
  })

  it('never throws even when the provider is completely unreachable', () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed')) as unknown as typeof fetch

    expect(() => {
      sendEmailFireAndForget({
        to: 'student@example.com',
        subject: 'Welcome!',
        html: '<p>Hi</p>',
        emailType: 'welcome',
      })
    }).not.toThrow()
  })
})
