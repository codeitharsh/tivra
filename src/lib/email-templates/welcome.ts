// ════════════════════════════════════════════════════════════════
// TIVRA — Welcome Email Template
//
// Real content provided by the platform owner (not placeholder).
// Shared chrome (head, header, CTA button, footer) lives in
// ./shared.ts — see that file's header comment for why email HTML
// has to be table-based with inline styles throughout.
// ════════════════════════════════════════════════════════════════

import { emailHead, emailOpen, ctaButton, featurePanel, emailClose, escapeHtml } from './shared'

export interface WelcomeEmailData {
  fullName: string
  email: string
  websiteUrl?: string // defaults to https://tivra.in if not provided
}

const WHATSAPP_URL = 'https://chat.whatsapp.com/FrYS4BBduCmDFXKFohTijq?mode=gi_t'

export function renderWelcomeEmail(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const firstName = data.fullName.split(' ')[0]
  const siteUrl = (data.websiteUrl ?? 'https://tivra.in').replace(/\/$/, '')
  const programsUrl = `${siteUrl}/programs`
  const year = new Date().getFullYear()

  const subject = 'Welcome to Tivra 🚀 | Your Tech Journey Starts Here'

  const html = `${emailHead(subject)}${emailOpen({
    preheaderHtml: 'Your Tivra account is ready. Explore programmes and start your tech journey.',
    siteUrl,
  })}

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#111111; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>Welcome to Tivra! 🎉
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280;">
        We're excited to have you as part of our growing community of future technology professionals.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:#6b7280; margin-top:10px;">
        Your account has been successfully created, and you're now one step closer to building a successful career in tech.
      </div>
    </td>
  </tr>

  ${featurePanel({
    heading: "What's Next?",
    rows: [
      ['📚', 'Structured learning modules'],
      ['💻', 'Live interactive classes'],
      ['📝', 'Weekly tests & assessments'],
      ['📄', 'Study notes & resources'],
      ['🎓', 'Verifiable certificates'],
      ['💬', 'Doubt support & community'],
    ],
  })}

  <tr>
    <td class="fluid-padding" style="padding:14px 40px 0;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:12px; line-height:1.6; color:#9ca3af; font-style:italic;">
        Note: Your learning dashboard and course content will be unlocked after you successfully enroll in a program.
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      ${ctaButton({ href: programsUrl, label: 'Explore Programs →' })}
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:28px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:rgba(37,211,102,0.08); border:1px solid rgba(37,211,102,0.25); border-radius:14px;">
        <tr>
          <td style="padding:18px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:14px; vertical-align:middle;">
                  <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" border="0" style="background-color:#25d366; border-radius:50%;">
                    <tr>
                      <td align="center" valign="middle" style="width:36px; height:36px; font-size:16px;">
                        <span style="color:#ffffff;">&#9743;</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:13.5px; color:#111111; margin-bottom:3px;">
                    Join Our WhatsApp Community
                  </div>
                  <div style="font-family:'DM Sans',Arial,sans-serif; font-size:12px; color:#6b7280; line-height:1.5;">
                    Stay updated with announcements, class reminders, resources, and important updates.
                  </div>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;">
              <a href="${WHATSAPP_URL}" target="_blank"
                style="display:inline-block; padding:10px 22px; border-radius:100px; background-color:#25d366; color:#ffffff; text-decoration:none; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:12.5px;">
                Join Community &rarr;
              </a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 32px;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:#6b7280;">
        If you have any questions, we're always here to help.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.9; color:#6b7280; margin-top:8px;">
        📧 <a href="mailto:contact@tivra.in" style="color:#4a3fe0; text-decoration:none;">contact@tivra.in</a><br>
        🌐 <a href="${siteUrl}" style="color:#4a3fe0; text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; color:#111111; margin-top:20px;">
        Rise Beyond.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#6b7280; margin-top:4px;">
        Team Tivra<br>
        <span style="font-style:italic; color:#9ca3af;">Building careers, not just courses.</span>
      </div>
    </td>
  </tr>
${emailClose({
  siteUrl, year,
  legalLine: "You're receiving this email because you created an account on Tivra.",
})}`.trim()

  const text = [
    `Hi ${firstName},`,
    '',
    'Welcome to Tivra! 🎉',
    '',
    "We're excited to have you as part of our growing community of future technology professionals.",
    "Your account has been successfully created, and you're now one step closer to building a successful career in tech.",
    '',
    "WHAT'S NEXT?",
    '1. Explore our programs and find the one that matches your career goals.',
    '2. Enroll to unlock your learning dashboard.',
    '',
    'Get access to:',
    '- Structured learning modules',
    '- Live interactive classes',
    '- Weekly tests & assessments',
    '- Study notes & resources',
    '- Verifiable certificates',
    '- Doubt support & community',
    '',
    'Note: Your learning dashboard and course content will be unlocked after you successfully enroll in a program.',
    '',
    `Explore Programs: ${programsUrl}`,
    '',
    'Join Our WhatsApp Community',
    'Stay updated with announcements, class reminders, resources, and important updates.',
    WHATSAPP_URL,
    '',
    "If you have any questions, we're always here to help.",
    'Email: contact@tivra.in',
    `Website: ${siteUrl}`,
    '',
    'Rise Beyond.',
    'Team Tivra',
    'Building careers, not just courses.',
    '',
    `You're receiving this email because you created an account on Tivra.`,
    `© ${year} Tivra. All rights reserved.`,
  ].join('\n')

  return { subject, html, text }
}
