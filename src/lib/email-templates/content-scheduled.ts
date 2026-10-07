// ════════════════════════════════════════════════════════════════
// TIVRA — Test/Assessment Scheduled Email Template
//
// Shared by weekly tests and phase assessments (parameterized by
// `kind`) since both are "a timed thing just became available to
// students". Shared chrome lives in ./shared.ts.
//
// unlockAt is optional: a weekly test can be created with NO unlock
// date at all, meaning it's open immediately (see the "available
// immediately" banner in TeacherTestsClient's create form) — that's
// still new content students should hear about, just worded as
// "is now available" instead of "unlocks on <date>".
// ════════════════════════════════════════════════════════════════

import { emailHead, emailOpen, ctaButton, emailClose, escapeHtml } from './shared'

export interface ContentScheduledEmailData {
  fullName?: string
  kind: 'test' | 'assessment'
  title: string
  programName: string
  programSlug: string
  unlockAt?: string // ISO datetime — omitted means "available right now"
  websiteUrl?: string // defaults to https://tivra.in if not provided
}

function formatIST(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)) + ' IST'
}

export function renderContentScheduledEmail(
  data: ContentScheduledEmailData
): { subject: string; html: string; text: string } {
  const firstName = data.fullName?.split(' ')[0] ?? 'there'
  const siteUrl = (data.websiteUrl ?? 'https://tivra.in').replace(/\/$/, '')
  const kindLabel = data.kind === 'test' ? 'test' : 'assessment'
  const contentUrl = `${siteUrl}/programs/${data.programSlug}/${data.kind === 'test' ? 'tests' : 'assessments'}`
  const year = new Date().getFullYear()
  const isImmediate = !data.unlockAt
  const unlockLabel = data.unlockAt ? formatIST(data.unlockAt) : null

  const subject = isImmediate
    ? `New ${kindLabel} available: ${data.title}`
    : `New ${kindLabel} scheduled: ${data.title}`
  const headline = isImmediate ? `A new ${kindLabel} is available right now 📋` : `A new ${kindLabel} just got scheduled 📋`
  const bodyLine = isImmediate
    ? `<strong style="color:#111111;">${escapeHtml(data.title)}</strong> in <strong style="color:#111111;">${escapeHtml(data.programName)}</strong> is open now — you can take it whenever you're ready.`
    : `<strong style="color:#111111;">${escapeHtml(data.title)}</strong> in <strong style="color:#111111;">${escapeHtml(data.programName)}</strong> unlocks on <strong style="color:#111111;">${unlockLabel}</strong>.`
  const footerLine = isImmediate
    ? "It's open now, so you can jump in right away."
    : "It'll stay locked until the time above, so there's nothing to do right now except mark your calendar."

  const html = `${emailHead(subject)}${emailOpen({
    preheaderHtml: isImmediate
      ? `${escapeHtml(data.title)} is open now.`
      : `${escapeHtml(data.title)} unlocks ${unlockLabel} — set a reminder.`,
    siteUrl,
  })}

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#111111; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>${headline}
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280;">
        ${bodyLine}
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      ${ctaButton({ href: contentUrl, label: `View ${kindLabel === 'test' ? 'Tests' : 'Assessments'} →` })}
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 32px;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:#6b7280;">
        ${footerLine}
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; color:#111111; margin-top:20px;">
        Rise Beyond.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#6b7280; margin-top:4px;">
        Team Tivra
      </div>
    </td>
  </tr>
${emailClose({
  siteUrl, year,
  legalLine: `You're receiving this email because you're enrolled in ${escapeHtml(data.programName)} on Tivra.`,
})}`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    headline.replace(' 📋', ''),
    '',
    isImmediate
      ? `${data.title} in ${data.programName} is open now — you can take it whenever you're ready.`
      : `${data.title} in ${data.programName} unlocks on ${unlockLabel}.`,
    '',
    `View: ${contentUrl}`,
    '',
    footerLine,
    '',
    'Rise Beyond.',
    'Team Tivra',
    '',
    `You're receiving this email because you're enrolled in ${data.programName} on Tivra.`,
    `© ${year} Tivra. All rights reserved.`,
  ].join('\n')

  return { subject, html, text }
}
