// ════════════════════════════════════════════════════════════════
// TIVRA — Course Purchase Confirmation Email Template
//
// Shared chrome lives in ./shared.ts, trimmed down here for a single-
// course purchase rather than a full programme enrollment.
// ════════════════════════════════════════════════════════════════

import { emailHead, emailOpen, ctaButton, emailClose, escapeHtml } from './shared'

export interface CoursePurchaseConfirmationEmailData {
  fullName?: string
  courseTitle: string
  courseSlug: string
  amountPaid: number // rupees
  websiteUrl?: string
}

export function renderCoursePurchaseConfirmationEmail(
  data: CoursePurchaseConfirmationEmailData
): { subject: string; html: string; text: string } {
  const firstName = data.fullName?.split(' ')[0] ?? 'there'
  const siteUrl = (data.websiteUrl ?? 'https://tivra.in').replace(/\/$/, '')
  const courseUrl = `${siteUrl}/courses/${data.courseSlug}`
  const year = new Date().getFullYear()
  const amountLabel = `₹${data.amountPaid.toLocaleString('en-IN')}`

  const subject = `You're in — ${data.courseTitle} is unlocked! 🎉`

  const html = `${emailHead(subject)}${emailOpen({
    preheaderHtml: `Your purchase of ${escapeHtml(data.courseTitle)} is confirmed and unlocked.`,
    siteUrl,
  })}

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#111111; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>Your purchase is confirmed! 🎉
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280;">
        We've verified your payment of <strong style="color:#111111;">${amountLabel}</strong> for
        <strong style="color:#111111;">${escapeHtml(data.courseTitle)}</strong>. It's unlocked in your account right now —
        including its module tests, final assessment, and certificate on completion.
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      ${ctaButton({ href: courseUrl, label: 'Start learning →' })}
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 32px;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:#6b7280;">
        Questions about your purchase? We're here to help.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.9; color:#6b7280; margin-top:8px;">
        📧 <a href="mailto:contact@tivra.in" style="color:#4a3fe0; text-decoration:none;">contact@tivra.in</a>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; color:#111111; margin-top:20px;">Rise Beyond.</div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#6b7280; margin-top:4px;">Team Tivra</div>
    </td>
  </tr>
${emailClose({
  siteUrl, year,
  legalLine: "You're receiving this email because you purchased a course on Tivra.",
})}`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    'Your purchase is confirmed! 🎉',
    '',
    `We've verified your payment of ${amountLabel} for ${data.courseTitle}. It's unlocked in your account right now.`,
    '',
    `Start learning: ${courseUrl}`,
    '',
    'Questions about your purchase? Email: contact@tivra.in',
    '',
    'Rise Beyond.',
    'Team Tivra',
    '',
    "You're receiving this email because you purchased a course on Tivra.",
    `© ${year} Tivra. All rights reserved.`,
  ].join('\n')

  return { subject, html, text }
}
