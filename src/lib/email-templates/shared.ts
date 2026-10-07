// ════════════════════════════════════════════════════════════════
// TIVRA — Shared email chrome
//
// Every template in this directory renders the same outer document:
// a light page background, a white rounded card, a plain white header
// showing the real wordmark image, and a dark closing footer band
// (mirroring the website's own "one dark surface, at the very end"
// footer). Only the content between header and footer differs per
// template, so that chrome — plus the two small compatibility helpers
// every template also duplicated — lives here once.
//
// Table-based layout, inline styles throughout, MSO conditional
// comments for the CTA button: a hard requirement for email HTML, not
// a style preference. Outlook desktop renders via Word's HTML engine
// (no border-radius, no flexbox/grid), Gmail strips <style> blocks in
// some views, and many clients only honor inline style="" attributes.
// The button is the one element that still needs a VML fallback —
// everything else in this new design is a plain image or solid color,
// which Outlook already renders correctly without help.
// ════════════════════════════════════════════════════════════════

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function emailHead(subject: string): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
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
</head>`
}

// Everything from <body> through the header row. `preheader` is the
// hidden inbox-preview snippet; callers pass already-escaped HTML for
// it since it's usually built from multiple interpolated fields.
export function emailOpen(opts: { preheaderHtml: string; siteUrl: string }): string {
  const wordmarkUrl = `${opts.siteUrl}/brand/tivra-wordmark-full-dark.png`
  return `
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'DM Sans', Arial, Helvetica, sans-serif;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
  ${opts.preheaderHtml}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
<tr>
<td align="center" style="padding:32px 16px;">

<table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px; background-color:#ffffff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden;">

  <tr>
    <td align="center" style="padding:30px 24px; background-color:#ffffff; border-bottom:1px solid #e5e7eb;">
      <img src="${wordmarkUrl}" width="130" height="54" alt="Tivra Learning"
        style="display:block; margin:0 auto; width:130px; height:54px; border:0;">
    </td>
  </tr>`
}

// The CTA button: solid black, rounded — matching the site's own
// .btn-primary — with a plain-fill VML roundrect for Outlook (no
// gradient to fake anymore, so no v:fill/v:textbox nesting needed).
export function ctaButton(opts: { href: string; label: string }): string {
  return `
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${opts.href}" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="#111111" stroke="f">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">${escapeHtml(opts.label)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${opts.href}" target="_blank" class="stack-button"
        style="display:inline-block; padding:14px 36px; border-radius:8px; background-color:#111111; color:#ffffff; text-decoration:none; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:14px; letter-spacing:0.01em;">
        ${escapeHtml(opts.label)}
      </a>
      <!--<![endif]-->`
}

// The optional light-gray highlight panel used by a couple of
// templates for a short "what's included / what's next" list.
export function featurePanel(opts: { heading: string; rows: [emoji: string, label: string][] }): string {
  const rowsHtml = opts.rows.map(([emoji, label]) => `
    <tr>
      <td style="padding:5px 0; font-size:13.5px; line-height:1.6;">
        <span style="display:inline-block; width:22px;">${emoji}</span>
        <span style="font-family:'DM Sans',Arial,sans-serif; color:#374151;">${escapeHtml(label)}</span>
      </td>
    </tr>`).join('')

  return `
  <tr>
    <td class="fluid-padding" style="padding:28px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:#f8f9fa; border:1px solid #e5e7eb; border-radius:12px;">
        <tr>
          <td style="padding:22px 24px;">
            <div style="font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:15px; color:#111111; margin-bottom:14px;">
              ${escapeHtml(opts.heading)}
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rowsHtml}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

// The dark closing band (the one dark surface, same idea as the
// website's own footer) through the closing tags. `legalLine`
// is the one line of per-template "why you're receiving this".
export function emailClose(opts: { siteUrl: string; year: number; legalLine: string }): string {
  const wordmarkWhiteUrl = `${opts.siteUrl}/brand/tivra-wordmark-full-white.png`
  return `
  <tr>
    <td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#101010;">
        <tr>
          <td align="center" style="padding:32px 24px;">
            <img src="${wordmarkWhiteUrl}" width="108" height="45" alt="Tivra Learning"
              style="display:block; margin:0 auto 18px; width:108px; height:45px; border:0;">
            <div style="font-family:'DM Sans',Arial,sans-serif; font-size:11px; line-height:1.7; color:rgba(255,255,255,0.35);">
              ${opts.legalLine}<br>
              &copy; ${opts.year} Tivra. All rights reserved.
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
</html>`
}
