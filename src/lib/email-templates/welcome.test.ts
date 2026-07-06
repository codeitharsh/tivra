import { describe, it, expect } from 'vitest'
import { renderWelcomeEmail } from './welcome'

describe('renderWelcomeEmail', () => {
  it('uses the exact fixed subject line provided by the platform owner', () => {
    const { subject } = renderWelcomeEmail({ fullName: 'Priya Sharma', email: 'priya@example.com' })
    expect(subject).toBe('Welcome to Tivra 🚀 | Your Tech Journey Starts Here')
  })

  it('renders valid HTML containing the recipient\'s first name', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Rahul Kumar', email: 'rahul@example.com' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Hi Rahul')
    expect(html).toContain('TIVRA')
  })

  it('uses only the first name, not the full name, in the greeting', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Rahul Kumar Sharma', email: 'rahul@example.com' })
    expect(html).toContain('Hi Rahul,')
    expect(html).not.toContain('Hi Rahul Kumar Sharma')
  })

  it('produces a non-empty plain-text fallback with no HTML tags', () => {
    const { text } = renderWelcomeEmail({ fullName: 'Test User', email: 'test@example.com' })
    expect(text.length).toBeGreaterThan(20)
    expect(text).toContain('Test')
    expect(text).not.toMatch(/<[a-z]+>/i)
  })

  it('escapes HTML-significant characters in the name so markup cannot break or be injected', () => {
    const { html } = renderWelcomeEmail({ fullName: "O'Brien <script>", email: 'obrien@example.com' })
    expect(html).toContain('DOCTYPE') // template rendered fully, not truncated
    expect(html).not.toContain('<script>') // raw tag must never appear unescaped
  })

  it('includes a working CTA link to /programs on the configured site URL', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com' })
    expect(html).toMatch(/href="https:\/\/tivra\.in\/programs"/)
  })

  it('respects a custom websiteUrl when provided, for staging/preview environments', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com', websiteUrl: 'https://staging.tivra.in' })
    expect(html).toContain('https://staging.tivra.in/programs')
  })

  it('uses the real Tivra logo image at a public URL, not just a text wordmark', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com' })
    expect(html).toContain('<img src="https://tivra.in/tivra-logo-no-bg.png"')
    expect(html).toContain('alt="Tivra"')
    // width/height must be set as HTML attributes (not just CSS) since
    // Outlook ignores CSS sizing on images
    expect(html).toMatch(/<img[^>]+width="44"[^>]+height="44"/)
  })

  it('derives the logo URL from a custom websiteUrl for staging environments', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com', websiteUrl: 'https://staging.tivra.in' })
    expect(html).toContain('https://staging.tivra.in/tivra-logo-no-bg.png')
  })

  it('includes the WhatsApp community link exactly as specified', () => {
    const { html, text } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com' })
    const waLink = 'https://chat.whatsapp.com/FrYS4BBduCmDFXKFohTijq?mode=gi_t'
    expect(html).toContain(waLink)
    expect(text).toContain(waLink)
  })

  it('includes all 6 feature bullets from the provided content', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com' })
    expect(html).toContain('Structured learning modules')
    expect(html).toContain('Live interactive classes')
    expect(html).toContain('Weekly tests &amp; assessments')
    expect(html).toContain('Study notes &amp; resources')
    expect(html).toContain('Verifiable certificates')
    expect(html).toContain('Doubt support &amp; community')
  })

  it('includes the current year in the copyright footer', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com' })
    const year = new Date().getFullYear().toString()
    expect(html).toContain(`&copy; ${year} Tivra`)
  })

  it('includes MSO conditional comments for Outlook compatibility', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com' })
    expect(html).toContain('<!--[if mso]>')
    expect(html).toContain('v:roundrect') // VML button fallback for Outlook
  })

  it('uses table-based layout, not flexbox or grid, for email client compatibility', () => {
    const { html } = renderWelcomeEmail({ fullName: 'Test', email: 'test@example.com' })
    expect(html).not.toContain('display:flex')
    expect(html).not.toContain('display: flex')
    expect(html).not.toContain('display:grid')
  })
})

