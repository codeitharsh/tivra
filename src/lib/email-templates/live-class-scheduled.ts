// ════════════════════════════════════════════════════════════════
// TIVRA — Live Class Scheduled Email Template
//
// Deliberately does NOT embed the raw Teams join_url — the live
// session route's own comments already note that a forwarded raw
// link bypasses Tivra's batch/programme access gate the same way a
// plain Jitsi link did. Routing through /live keeps
// checkLiveSessionAccess as the actual gate. Same table-based/
// inline-style/MSO-safe approach as welcome.ts.
// ════════════════════════════════════════════════════════════════

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
  const logoUrl = `${siteUrl}/tivra-logo-no-bg.png`
  const year = new Date().getFullYear()
  const whenLabel = formatIST(data.scheduledAt)

  const subject = `Live class scheduled: ${data.title}`

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
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
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
  ${escapeHtml(data.title)} is live ${whenLabel} — join from your Tivra dashboard.
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
      <!--[if mso]></v:textbox></v:rect><![endif]-->
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#ffffff; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>A live class just got scheduled 🎥
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:rgba(255,255,255,0.65);">
        <strong style="color:#ffffff;">${escapeHtml(data.title)}</strong> is happening on
        <strong style="color:#ffffff;">${whenLabel}</strong> (${data.durationMinutes} min).
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${liveUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="50%" fillcolor="#3b5bdb" stroke="f">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">Open Live Classes &rarr;</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${liveUrl}" target="_blank" class="stack-button"
        style="display:inline-block; padding:15px 40px; border-radius:100px; background-color:#3b5bdb; background-image:linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed); color:#ffffff; text-decoration:none; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; letter-spacing:0.02em;">
        Open Live Classes &rarr;
      </a>
      <!--<![endif]-->
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 0;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:rgba(255,255,255,0.55);">
        The join link becomes available on that page once you're signed in — we don't send the raw meeting link by email so it can't be forwarded outside Tivra.
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; color:#ffffff; margin-top:20px;">
        Rise Beyond.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:rgba(255,255,255,0.5); margin-top:4px;">
        Team Tivra
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:28px 40px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1c1f28;">
        <tr>
          <td style="padding-top:18px;">
            <div style="font-family:'DM Sans',Arial,sans-serif; font-size:11px; line-height:1.7; color:rgba(255,255,255,0.28);">
              You're receiving this email because this live class is scheduled for your batch/programme on Tivra.<br>
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
