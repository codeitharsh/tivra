// ════════════════════════════════════════════════════════════════
// TIVRA — Career Path Bundle Purchase Confirmation Email Template
//
// Shared chrome lives in ./shared.ts. Mirrors
// course-purchase-confirmation.ts, worded for a multi-course bundle.
// ════════════════════════════════════════════════════════════════

import { emailHead, emailOpen, ctaButton, emailClose, escapeHtml } from './shared'

export interface CareerPathPurchaseConfirmationEmailData {
  fullName?: string
  pathTitle: string
  pathSlug: string
  courseCount: number
  amountPaid: number // rupees
  websiteUrl?: string
}

export function renderCareerPathPurchaseConfirmationEmail(
  data: CareerPathPurchaseConfirmationEmailData
): { subject: string; html: string; text: string } {
  const firstName = data.fullName?.split(' ')[0] ?? 'there'
  const siteUrl = (data.websiteUrl ?? 'https://tivra.in').replace(/\/$/, '')
  const pathUrl = `${siteUrl}/explore/roles/${data.pathSlug}`
  const year = new Date().getFullYear()
  const amountLabel = `₹${data.amountPaid.toLocaleString('en-IN')}`

  const subject = `You're in — ${data.pathTitle} is unlocked! 🎉`

  const html = `${emailHead(subject)}${emailOpen({
    preheaderHtml: `Your purchase of ${escapeHtml(data.pathTitle)} is confirmed and unlocked.`,
    siteUrl,
  })}

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#111111; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>Your purchase is confirmed! 🎉
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280;">
        We've verified your payment of <strong style="color:#111111;">${amountLabel}</strong> for the
        <strong style="color:#111111;">${escapeHtml(data.pathTitle)}</strong> career path. All
        ${data.courseCount} course${data.courseCount !== 1 ? 's' : ''} in it are unlocked in your account right now.
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      ${ctaButton({ href: pathUrl, label: 'Start learning →' })}
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
  legalLine: "You're receiving this email because you purchased a career path bundle on Tivra.",
})}`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    'Your purchase is confirmed! 🎉',
    '',
    `We've verified your payment of ${amountLabel} for the ${data.pathTitle} career path. All ${data.courseCount} course${data.courseCount !== 1 ? 's' : ''} in it are unlocked in your account right now.`,
    '',
    `Start learning: ${pathUrl}`,
    '',
    'Questions about your purchase? Email: contact@tivra.in',
    '',
    'Rise Beyond.',
    'Team Tivra',
    '',
    "You're receiving this email because you purchased a career path bundle on Tivra.",
    `© ${year} Tivra. All rights reserved.`,
  ].join('\n')

  return { subject, html, text }
}
