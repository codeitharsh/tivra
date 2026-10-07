// ════════════════════════════════════════════════════════════════
// TIVRA — Enrollment Confirmation Email Template
//
// Shared chrome lives in ./shared.ts — see that file's header comment
// for why email HTML has to be table-based with inline styles.
// ════════════════════════════════════════════════════════════════

import { emailHead, emailOpen, ctaButton, featurePanel, emailClose, escapeHtml } from './shared'

export interface EnrollmentConfirmationEmailData {
  fullName?: string
  programName: string
  amountPaid: number // rupees
  websiteUrl?: string // defaults to https://tivra.in if not provided
}

export function renderEnrollmentConfirmationEmail(
  data: EnrollmentConfirmationEmailData
): { subject: string; html: string; text: string } {
  const firstName = data.fullName?.split(' ')[0] ?? 'there'
  const siteUrl = (data.websiteUrl ?? 'https://tivra.in').replace(/\/$/, '')
  const dashboardUrl = `${siteUrl}/dashboard`
  const year = new Date().getFullYear()
  const amountLabel = `₹${data.amountPaid.toLocaleString('en-IN')}`

  const subject = `You're enrolled in ${data.programName}! 🎉`

  const html = `${emailHead(subject)}${emailOpen({
    preheaderHtml: `Your payment is verified — ${escapeHtml(data.programName)} is unlocked in your dashboard.`,
    siteUrl,
  })}

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#111111; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>Payment confirmed — you're in! 🎉
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280;">
        We've verified your payment of <strong style="color:#111111;">${amountLabel}</strong> and enrolled you in
        <strong style="color:#111111;">${escapeHtml(data.programName)}</strong>. Full access is unlocked right now.
      </div>
    </td>
  </tr>

  ${featurePanel({
    heading: "What's unlocked now",
    rows: [
      ['🎥', 'Live weekly classes'],
      ['📄', 'Study notes & recordings'],
      ['📋', 'Weekly tests & assessments'],
      ['💬', 'Doubt Corner support'],
      ['🎓', 'Verified certificate on completion'],
    ],
  })}

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      ${ctaButton({ href: dashboardUrl, label: 'Go to Dashboard →' })}
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 32px;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:#6b7280;">
        Questions about your enrollment or payment? We're here to help.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.9; color:#6b7280; margin-top:8px;">
        📧 <a href="mailto:contact@tivra.in" style="color:#4a3fe0; text-decoration:none;">contact@tivra.in</a>
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
  legalLine: "You're receiving this email because you enrolled in a programme on Tivra.",
})}`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    'Payment confirmed — you\'re in! 🎉',
    '',
    `We've verified your payment of ${amountLabel} and enrolled you in ${data.programName}. Full access is unlocked right now.`,
    '',
    "What's unlocked now:",
    '- Live weekly classes',
    '- Study notes & recordings',
    '- Weekly tests & assessments',
    '- Doubt Corner support',
    '- Verified certificate on completion',
    '',
    `Go to your dashboard: ${dashboardUrl}`,
    '',
    'Questions about your enrollment or payment? We\'re here to help.',
    'Email: contact@tivra.in',
    '',
    'Rise Beyond.',
    'Team Tivra',
    '',
    "You're receiving this email because you enrolled in a programme on Tivra.",
    `© ${year} Tivra. All rights reserved.`,
  ].join('\n')

  return { subject, html, text }
}
