// ════════════════════════════════════════════════════════════════
// TIVRA — Notes Uploaded Email Template
//
// Shared chrome lives in ./shared.ts.
// ════════════════════════════════════════════════════════════════

import { emailHead, emailOpen, ctaButton, emailClose, escapeHtml } from './shared'

export interface NotesUploadedEmailData {
  fullName?: string
  moduleTitle: string
  programName: string
  programSlug: string
  websiteUrl?: string // defaults to https://tivra.in if not provided
}

export function renderNotesUploadedEmail(
  data: NotesUploadedEmailData
): { subject: string; html: string; text: string } {
  const firstName = data.fullName?.split(' ')[0] ?? 'there'
  const siteUrl = (data.websiteUrl ?? 'https://tivra.in').replace(/\/$/, '')
  const contentUrl = `${siteUrl}/programs/${data.programSlug}/content`
  const year = new Date().getFullYear()

  const subject = `New notes available: ${data.moduleTitle}`

  const html = `${emailHead(subject)}${emailOpen({
    preheaderHtml: `New notes are up for ${escapeHtml(data.moduleTitle)} in ${escapeHtml(data.programName)}.`,
    siteUrl,
  })}

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#111111; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>New notes are up 📄
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280;">
        Your teacher just uploaded notes for <strong style="color:#111111;">${escapeHtml(data.moduleTitle)}</strong>
        in <strong style="color:#111111;">${escapeHtml(data.programName)}</strong>. They're available in your dashboard now.
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      ${ctaButton({ href: contentUrl, label: 'Open Notes →' })}
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 32px;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:#6b7280;">
        Questions about this module? Post it in Doubt Corner and your teacher will answer directly.
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
    'New notes are up 📄',
    '',
    `Your teacher just uploaded notes for ${data.moduleTitle} in ${data.programName}. They're available in your dashboard now.`,
    '',
    `Open Notes: ${contentUrl}`,
    '',
    'Questions about this module? Post it in Doubt Corner and your teacher will answer directly.',
    '',
    'Rise Beyond.',
    'Team Tivra',
    '',
    `You're receiving this email because you're enrolled in ${data.programName} on Tivra.`,
    `© ${year} Tivra. All rights reserved.`,
  ].join('\n')

  return { subject, html, text }
}
