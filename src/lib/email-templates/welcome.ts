// ════════════════════════════════════════════════════════════════
// TIVRA — Welcome Email Template
//
// Real content provided by the platform owner (not placeholder).
// Built with table-based layout and inline styles throughout — this
// is a hard requirement for email HTML, not a style preference:
// - Outlook desktop renders using Word's HTML engine, which does not
//   support CSS gradients, border-radius reliably, flexbox, or grid.
// - Gmail strips <style> blocks in some contexts (e.g. AMP/clipped view).
// - Many clients ignore external/embedded CSS entirely and only honor
//   inline style="" attributes.
// MSO conditional comments provide VML fallbacks for the gradient
// header and CTA button so Outlook renders a solid, on-brand color
// instead of a blank or broken box where the gradient would be.
// ════════════════════════════════════════════════════════════════

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
  // Email images must be a public HTTP(S) URL — recipients' inboxes fetch
  // this over the network, they cannot reach a local file path the way
  // Next.js's <Image src="/tivra-logo-no-bg.png"> does elsewhere in the
  // app. Deriving it from siteUrl means this automatically points at
  // the right environment if websiteUrl is ever overridden for staging.
  const logoUrl = `${siteUrl}/tivra-logo-no-bg.png`
  const year = new Date().getFullYear()

  const subject = 'Welcome to Tivra 🚀 | Your Tech Journey Starts Here'

  const html = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${subject}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: 480px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 20px !important; padding-right: 20px !important; }
    .stack-button { display: block !important; width: 100% !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#07080c; font-family:'DM Sans', Arial, Helvetica, sans-serif;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
  Your Tivra account is ready. Explore programmes and start your tech journey.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#07080c;">
<tr>
<td align="center" style="padding:32px 16px;">

<table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px; background-color:#0d0f14; border-radius:16px; border:1px solid #1c1f28; overflow:hidden;">

  <tr>
    <td style="padding:0;">
      <!--[if mso]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:560px;height:100px;">
        <v:fill type="gradient" color="#00d4ff" color2="#7c3aed" angle="45" />
        <v:textbox inset="0,0,0,0">
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:#3b5bdb; background-image:linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed);">
        <tr>
          <td align="center" style="padding:26px 24px;">
            <!-- Real Tivra logo image. width/height set explicitly (required —
                 many clients, especially Outlook, ignore CSS width/height on
                 images and will render at native pixel size otherwise). alt
                 text carries the brand name for the very common case where
                 images are blocked by default until the recipient clicks
                 "display images" (Gmail and Outlook both do this). -->
            <img src="${logoUrl}" width="44" height="44" alt="Tivra"
              style="display:block; margin:0 auto 8px; width:44px; height:44px; border-radius:10px; border:0;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:20px; letter-spacing:3px; color:#ffffff;">
              TIVRA
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif; font-size:10px; color:rgba(255,255,255,0.85); letter-spacing:4px; text-transform:uppercase; margin-top:3px;">
              Rise Beyond
            </div>
          </td>
        </tr>
      </table>
      <!--[if mso]>
        </v:textbox>
      </v:rect>
      <![endif]-->
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#ffffff; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>Welcome to Tivra! 🎉
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:rgba(255,255,255,0.65);">
        We're excited to have you as part of our growing community of future technology professionals.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:rgba(255,255,255,0.65); margin-top:10px;">
        Your account has been successfully created, and you're now one step closer to building a successful career in tech.
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:28px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:#12151d; border:1px solid #1f2430; border-radius:14px;">
        <tr>
          <td style="padding:22px 24px;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:15px; color:#00d4ff; margin-bottom:14px;">
              What's Next?
            </div>
            <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13.5px; line-height:1.7; color:rgba(255,255,255,0.75); margin-bottom:6px;">
              1. Explore our programs and find the one that matches your career goals.
            </div>
            <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13.5px; line-height:1.7; color:rgba(255,255,255,0.75); margin-bottom:16px;">
              2. Enroll to unlock your learning dashboard.
            </div>

            <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:12.5px; color:rgba(255,255,255,0.5); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:12px;">
              Get access to:
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${featureRow('📚', 'Structured learning modules')}
              ${featureRow('💻', 'Live interactive classes')}
              ${featureRow('📝', 'Weekly tests & assessments')}
              ${featureRow('📄', 'Study notes & resources')}
              ${featureRow('🎓', 'Verifiable certificates')}
              ${featureRow('💬', 'Doubt support & community')}
            </table>
          </td>
        </tr>
      </table>

      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:12px; line-height:1.6; color:rgba(255,255,255,0.35); font-style:italic; margin-top:14px;">
        Note: Your learning dashboard and course content will be unlocked after you successfully enroll in a program.
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${programsUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="50%" fillcolor="#3b5bdb" stroke="f">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">Explore Programs &rarr;</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${programsUrl}" target="_blank" class="stack-button"
        style="display:inline-block; padding:15px 40px; border-radius:100px; background-color:#3b5bdb; background-image:linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed); color:#ffffff; text-decoration:none; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; letter-spacing:0.02em;">
        Explore Programs &rarr;
      </a>
      <!--<![endif]-->
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
                  <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:13.5px; color:#ffffff; margin-bottom:3px;">
                    Join Our WhatsApp Community
                  </div>
                  <div style="font-family:'DM Sans',Arial,sans-serif; font-size:12px; color:rgba(255,255,255,0.5); line-height:1.5;">
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
    <td class="fluid-padding" style="padding:30px 40px 0;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:rgba(255,255,255,0.55);">
        If you have any questions, we're always here to help.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.9; color:rgba(255,255,255,0.55); margin-top:8px;">
        📧 <a href="mailto:contact@tivra.in" style="color:#00d4ff; text-decoration:none;">contact@tivra.in</a><br>
        🌐 <a href="${siteUrl}" style="color:#00d4ff; text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; color:#ffffff; margin-top:20px;">
        Rise Beyond.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:rgba(255,255,255,0.5); margin-top:4px;">
        Team Tivra<br>
        <span style="font-style:italic; color:rgba(255,255,255,0.35);">Building careers, not just courses.</span>
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:28px 40px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1c1f28;">
        <tr>
          <td style="padding-top:18px;">
            <div style="font-family:'DM Sans',Arial,sans-serif; font-size:11px; line-height:1.7; color:rgba(255,255,255,0.28);">
              You're receiving this email because you created an account on Tivra.<br>
              &copy; ${year} Tivra. All rights reserved.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`.trim()

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

function featureRow(emoji: string, label: string): string {
  return `
    <tr>
      <td style="padding:5px 0; font-size:13.5px; line-height:1.6;">
        <span style="display:inline-block; width:22px;">${emoji}</span>
        <span style="font-family:'DM Sans',Arial,sans-serif; color:rgba(255,255,255,0.75);">${escapeHtml(label)}</span>
      </td>
    </tr>
  `
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
