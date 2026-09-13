// ════════════════════════════════════════════════════════════════
// TIVRA — Course Purchase Confirmation Email Template
//
// Same table-based/inline-style/MSO-safe approach as
// enrollment-confirmation.ts, trimmed down for a single-course
// purchase rather than a full programme enrollment.
// ════════════════════════════════════════════════════════════════

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
  const logoUrl = `${siteUrl}/tivra-logo-no-bg.png`
  const year = new Date().getFullYear()
  const amountLabel = `₹${data.amountPaid.toLocaleString('en-IN')}`

  const subject = `You're in — ${data.courseTitle} is unlocked! 🎉`

  const html = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
<style>
  @media only screen and (max-width: 480px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 20px !important; padding-right: 20px !important; }
    .stack-button { display: block !important; width: 100% !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#07080c; font-family:'DM Sans', Arial, Helvetica, sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#07080c;">
<tr>
<td align="center" style="padding:32px 16px;">

<table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px; background-color:#0d0f14; border-radius:16px; border:1px solid #1c1f28; overflow:hidden;">

  <tr>
    <td align="center" style="padding:26px 24px; background-color:#3b5bdb; background-image:linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed);">
      <img src="${logoUrl}" width="44" height="44" alt="Tivra" style="display:block; margin:0 auto 8px; width:44px; height:44px; border-radius:10px; border:0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:20px; letter-spacing:3px; color:#ffffff;">TIVRA</div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:36px 40px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:22px; color:#ffffff; line-height:1.35; margin-bottom:14px;">
        Hi ${escapeHtml(firstName)},<br>Your purchase is confirmed! 🎉
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.75; color:rgba(255,255,255,0.65);">
        We've verified your payment of <strong style="color:#ffffff;">${amountLabel}</strong> for
        <strong style="color:#ffffff;">${escapeHtml(data.courseTitle)}</strong>. It's unlocked in your account right now —
        including its module tests, final assessment, and certificate on completion.
      </div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" align="center" style="padding:30px 40px 0;">
      <a href="${courseUrl}" target="_blank" class="stack-button"
        style="display:inline-block; padding:15px 40px; border-radius:100px; background-color:#3b5bdb; background-image:linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed); color:#ffffff; text-decoration:none; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; letter-spacing:0.02em;">
        Start learning &rarr;
      </a>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:30px 40px 0;">
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.7; color:rgba(255,255,255,0.55);">
        Questions about your purchase? We're here to help.
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.9; color:rgba(255,255,255,0.55); margin-top:8px;">
        📧 <a href="mailto:contact@tivra.in" style="color:#00d4ff; text-decoration:none;">contact@tivra.in</a>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; color:#ffffff; margin-top:20px;">Rise Beyond.</div>
      <div style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:rgba(255,255,255,0.5); margin-top:4px;">Team Tivra</div>
    </td>
  </tr>

  <tr>
    <td class="fluid-padding" style="padding:28px 40px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #1c1f28;">
        <tr>
          <td style="padding-top:18px;">
            <div style="font-family:'DM Sans',Arial,sans-serif; font-size:11px; line-height:1.7; color:rgba(255,255,255,0.28);">
              You're receiving this email because you purchased a course on Tivra.<br>
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
