// ════════════════════════════════════════════════════════════════
// TIVRA — Live Class Scheduled Email Template
//
// Deliberately does NOT embed the raw Teams join_url — the live
// session route's own comments already note that a forwarded raw
// link bypasses Tivra's batch/programme access gate the same way a
// plain Jitsi link did. Routing through /live keeps
// checkLiveSessionAccess as the actual gate. Shared chrome lives in
// ./shared.ts.
// ════════════════════════════════════════════════════════════════

import { emailHead, emailOpen, ctaButton, emailClose, escapeHtml } from './shared'

export interface LiveClassScheduledEmailData {
  fullName?: string
  title: string
  scheduledAt: string // ISO datetime
  durationMinutes: number
  websiteUrl?: string // defaults to https://tivra.in if not provided
}

function formatIST(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)) + ' IST'
}

export function renderLiveClassScheduledEmail(
  data: LiveClassScheduledEmailData
): { subject: string; html: string; text: string } {
  const firstName = data.fullName?.split(' ')[0] ?? 'there'
  const siteUrl = (data.websiteUrl ?? 'https://tivra.in').replace(/\/$/, '')
  const liveUrl = `${siteUrl}/live`
  const year = new Date().getFullYear()
  const whenLabel = formatIST(data.scheduledAt)

  const subject = `Live class scheduled: ${data.title}`

  const html = `${emailHead(subject)}${emailOpen({
    preheaderHtml: `${escapeHtml(data.title)} is live ${whenLabel} — join from your Tivra dashboard.`,
    siteUrl,
  })}

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#111111; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>A live class just got scheduled 🎥
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280;">
        <strong style="color:#111111;">${escapeHtml(data.title)}</strong> is happening on
        <strong style="color:#111111;">${whenLabel}</strong> (${data.durationMinutes} min).
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      ${ctaButton({ href: liveUrl, label: 'Open Live Classes →' })}
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 32px;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:#6b7280;">
        The join link becomes available on that page once you're signed in — we don't send the raw meeting link by email so it can't be forwarded outside Tivra.
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
  legalLine: "You're receiving this email because this live class is scheduled for your batch/programme on Tivra.",
})}`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    'A live class just got scheduled 🎥',
    '',
    `${data.title} is happening on ${whenLabel} (${data.durationMinutes} min).`,
    '',
    `Open Live Classes: ${liveUrl}`,
    '',
    "The join link becomes available on that page once you're signed in — we don't send the raw meeting link by email so it can't be forwarded outside Tivra.",
    '',
    'Rise Beyond.',
    'Team Tivra',
    '',
    "You're receiving this email because this live class is scheduled for your batch/programme on Tivra.",
    `© ${year} Tivra. All rights reserved.`,
  ].join('\n')

  return { subject, html, text }
}
