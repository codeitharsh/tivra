// Shared certificate PDF renderer, used by all three certificate routes
// (per-phase, programme-completion, course-completion). Previously each
// route returned an inline SVG image — that's why "Download" opened a new
// tab showing the certificate instead of downloading a file. pdf-lib is a
// pure-JS PDF library with no native/Node dependencies, so it runs fine on
// the edge runtime; the byte output is served with
// `Content-Disposition: attachment` so the browser always saves it as a
// real, printable .pdf file.
//
// Layout is a direct 0.7x scale-down of the original 1200x850 SVG template
// (840x595pt lands almost exactly on A4 landscape's 841.89x595.28, since
// 1200:850 and A4's ratio are both ~1.41:1) — every coordinate below is
// ported from that SVG, not re-eyeballed, so spacing/proportions match.
// pdf-lib's high-level API has no gradients, filters, or text stroking, so:
//   - the cyan→indigo→purple gradient is reproduced for real via
//     per-character interpolated fill color (drawGradientText/drawGradientLine)
//   - the SVG's glow filter is approximated with 2 oversized, low-opacity
//     copies of the name drawn behind the crisp top layer (a cheap bloom)

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { CERTIFICATE_LOGO_DATA_URI } from './certificate-mark'

const SCALE = 0.7          // 1200x850 SVG px -> 840x595 PDF pt
const PAGE_W = 1200 * SCALE
const PAGE_H = 850 * SCALE

const BG      = rgb(0x07 / 255, 0x08 / 255, 0x0c / 255)
const CYAN    = rgb(0x00 / 255, 0xd4 / 255, 0xff / 255)
const INDIGO  = rgb(0x3b / 255, 0x5b / 255, 0xdb / 255)
const PURPLE  = rgb(0x7c / 255, 0x3a / 255, 0xed / 255)
const WHITE   = rgb(1, 1, 1)
const AMBER   = rgb(0xf5 / 255, 0x9e / 255, 0x0b / 255)
const GRADIENT_STOPS: RGB[] = [CYAN, INDIGO, PURPLE]

// svgY (top-down, 1200x850) -> pdfY (bottom-up, 840x595)
const y = (svgY: number) => PAGE_H - svgY * SCALE
const x = (svgX: number) => svgX * SCALE
const s = (svgSize: number) => svgSize * SCALE

function decodeBase64(dataUri: string): Uint8Array {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

function interpolateGradient(stops: RGB[], t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t))
  const segment = clamped * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(segment))
  const localT = segment - i
  return rgb(
    lerp(stops[i].red,   stops[i + 1].red,   localT),
    lerp(stops[i].green, stops[i + 1].green, localT),
    lerp(stops[i].blue,  stops[i + 1].blue,  localT),
  )
}

function textWidth(font: PDFFont, text: string, size: number, letterSpacing: number): number {
  return text.split('').reduce((w, ch) => w + font.widthOfTextAtSize(ch, size) + letterSpacing, -letterSpacing)
}

/** Centered text, single solid color. */
function drawCentered(
  page: PDFPage, text: string, font: PDFFont, size: number, yPos: number,
  color: RGB, opacity: number, letterSpacing = 0,
) {
  const w = textWidth(font, text, size, letterSpacing)
  let cursorX = (PAGE_W - w) / 2
  for (const ch of text) {
    page.drawText(ch, { x: cursorX, y: yPos, size, font, color, opacity })
    cursorX += font.widthOfTextAtSize(ch, size) + letterSpacing
  }
}

/** Centered text, per-character cyan->indigo->purple gradient fill — the
 * real replacement for the SVG's gradient-stroked headline/wordmark text. */
function drawGradientText(
  page: PDFPage, text: string, font: PDFFont, size: number, yPos: number,
  opacity = 1, letterSpacing = 0,
) {
  const w = textWidth(font, text, size, letterSpacing)
  let cursorX = (PAGE_W - w) / 2
  const chars = text.split('')
  chars.forEach((ch, i) => {
    const color = interpolateGradient(GRADIENT_STOPS, chars.length <= 1 ? 0 : i / (chars.length - 1))
    page.drawText(ch, { x: cursorX, y: yPos, size, font, color, opacity })
    cursorX += font.widthOfTextAtSize(ch, size) + letterSpacing
  })
}

/** Horizontal divider line, drawn as 3 gradient bands (matches the SVG's
 * stroke="url(#accentGrad)" lines instead of a flat single-color line). */
function drawGradientLine(page: PDFPage, x1: number, x2: number, yPos: number, thickness: number, opacity: number) {
  const bandW = (x2 - x1) / GRADIENT_STOPS.length
  GRADIENT_STOPS.forEach((color, i) => {
    page.drawLine({
      start: { x: x1 + i * bandW, y: yPos }, end: { x: x1 + (i + 1) * bandW, y: yPos },
      thickness, color, opacity,
    })
  })
}

export interface CertificatePdfOptions {
  /** 'plain' = small italic caption, no background (phase certs).
   *  'pill' = rounded badge with background (programme/course certs). */
  eyebrowStyle: 'plain' | 'pill'
  eyebrow: string
  eyebrowColor?: 'cyan' | 'amber'
  name: string
  /** Line shown between the name and the headline, e.g. "has successfully completed" */
  leadLine: string
  /** The certified thing itself — phase title / programme name / course title */
  headline: string
  /** Line below the headline (programme/course certs) */
  tailLine?: string
  /** Pill badge below the headline (phase certs only — e.g. "AWS Cloud Practitioner") */
  badgeText?: string
  /** Score circle (phase certs only) */
  statValue?: string
  statLabel?: string
  issuedAt: string
  verifyCode: string
}

export async function generateCertificatePdf(opts: CertificatePdfOptions): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([PAGE_W, PAGE_H])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic  = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
  const fontMono    = await pdfDoc.embedFont(StandardFonts.Courier)

  const logoImage = await pdfDoc.embedPng(decodeBase64(CERTIFICATE_LOGO_DATA_URI))

  // ── Background + grid texture ───────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: BG })
  for (let gx = 0; gx <= 1200; gx += 60) {
    page.drawLine({ start: { x: x(gx), y: 0 }, end: { x: x(gx), y: PAGE_H }, thickness: 0.5, color: INDIGO, opacity: 0.06 })
  }
  for (let gy = 0; gy <= 850; gy += 60) {
    page.drawLine({ start: { x: 0, y: y(gy) }, end: { x: PAGE_W, y: y(gy) }, thickness: 0.5, color: INDIGO, opacity: 0.06 })
  }

  // ── Border frame ─────────────────────────────────────────────
  page.drawRectangle({ x: x(24), y: x(24), width: PAGE_W - x(48), height: PAGE_H - x(48), borderColor: INDIGO, borderWidth: s(1.5), borderOpacity: 0.5 })
  page.drawRectangle({ x: x(32), y: x(32), width: PAGE_W - x(64), height: PAGE_H - x(64), borderColor: INDIGO, borderWidth: s(1), borderOpacity: 0.15 })

  // Top accent bar (gradient)
  drawGradientLine(page, x(24), x(1176), y(24) - s(2), s(4), 1)

  // Corner accent brackets — 4 corners, each an L-shape (matches the SVG's
  // 8 small rects), drawn as gradient-colored bars.
  const corners: [number, number, boolean][] = [
    [24, 24, false], [24, 24, true], [1116, 24, false], [1172, 24, true],
    [24, 822, false], [24, 762, true], [1116, 822, false], [1172, 762, true],
  ]
  corners.forEach(([cx, cy, vertical]) => {
    const w = vertical ? s(4) : s(60)
    const h = vertical ? s(60) : s(4)
    const color = interpolateGradient(GRADIENT_STOPS, cx / 1200)
    page.drawRectangle({ x: x(cx), y: y(cy) - h, width: w, height: h, color })
  })

  // ── Logo + wordmark ──────────────────────────────────────────
  const logoSize = s(96)
  page.drawImage(logoImage, { x: (PAGE_W - logoSize) / 2, y: y(68) - logoSize, width: logoSize, height: logoSize })

  drawGradientText(page, 'TIVRA', fontBold, s(28), y(168), 0.95, s(14))
  drawCentered(page, 'RISE BEYOND', fontRegular, s(13), y(194), WHITE, 0.35, s(8))

  // ── Eyebrow ──────────────────────────────────────────────────
  // (No divider line here — the one below the name already separates the
  // wordmark block from the "has completed..." block; a second line right
  // above the eyebrow pill/caption made that top region feel double-ruled.)
  let cursorSvgY: number
  if (opts.eyebrowStyle === 'plain') {
    drawCentered(page, opts.eyebrow, fontItalic, s(22), y(278), WHITE, 0.5, s(3))
    cursorSvgY = 326
  } else {
    const eyebrowColor = opts.eyebrowColor === 'amber' ? AMBER : CYAN
    const pillW = fontBold.widthOfTextAtSize(opts.eyebrow, s(14)) + s(60)
    const pillX = (PAGE_W - pillW) / 2
    const pillYTop = y(240)
    const pillH = s(38)
    page.drawRectangle({ x: pillX, y: pillYTop - pillH, width: pillW, height: pillH, color: eyebrowColor, opacity: 0.12, borderColor: eyebrowColor, borderWidth: 1, borderOpacity: 0.5 })
    drawCentered(page, opts.eyebrow, fontBold, s(14), y(265), eyebrowColor, 1, s(2))
    cursorSvgY = 332
  }

  drawCentered(page, 'This certifies that', fontRegular, s(16), y(cursorSvgY), WHITE, 0.45, s(1))

  // ── Name (with a cheap glow: 2 soft oversized copies behind the crisp one) ──
  const nameSvgY = 402
  const nameSize = opts.name.length > 30 ? s(40) : s(54)
  drawCentered(page, opts.name, fontItalic, nameSize * 1.05, y(nameSvgY), WHITE, 0.06)
  drawCentered(page, opts.name, fontItalic, nameSize * 1.02, y(nameSvgY), WHITE, 0.1)
  drawCentered(page, opts.name, fontItalic, nameSize, y(nameSvgY), WHITE, 1)

  drawGradientLine(page, x(160), x(1040), y(420), s(1.5), 0.35)

  // ── Lead line + headline ────────────────────────────────────
  drawCentered(page, opts.leadLine, fontRegular, s(16), y(458), WHITE, 0.45, s(1))

  const headlineSize = opts.headline.length > 30 ? s(22) : s(30)
  drawGradientText(page, opts.headline, fontBold, headlineSize, y(510), 1, s(1))

  if (opts.tailLine) {
    drawCentered(page, opts.tailLine, fontRegular, s(16), y(572), WHITE, 0.5, s(1))
  }

  if (opts.badgeText) {
    const badgeW = s(600)
    const badgeH = s(44)
    const badgeX = (PAGE_W - badgeW) / 2
    const badgeYTop = y(530)
    page.drawRectangle({ x: badgeX, y: badgeYTop - badgeH, width: badgeW, height: badgeH, color: CYAN, opacity: 0.12, borderColor: CYAN, borderWidth: 1, borderOpacity: 0.4 })
    drawCentered(page, opts.badgeText, fontBold, s(18), y(558), CYAN, 1, s(1))
  }

  if (opts.statValue) {
    const cx = PAGE_W / 2
    const cyc = y(634)
    const r = s(46)
    page.drawEllipse({ x: cx, y: cyc, xScale: r, yScale: r, borderColor: CYAN, borderWidth: s(2), color: CYAN, opacity: 0.1, borderOpacity: 0.9 })
    drawCentered(page, opts.statValue, fontBold, s(28), y(642), CYAN, 1)
    if (opts.statLabel) drawCentered(page, opts.statLabel, fontRegular, s(10), y(660), WHITE, 0.45, s(2))
  }

  // ── Footer ───────────────────────────────────────────────────
  const labelY = y(728)
  const valueY = y(752)
  drawFooterColumn(page, fontRegular, fontBold, x(200), labelY, valueY, 'Issued On', opts.issuedAt, WHITE)
  drawFooterColumn(page, fontRegular, fontBold, x(600), labelY, valueY, 'Issued By', 'Tivra Learning', WHITE)
  drawFooterColumn(page, fontRegular, fontBold, x(1000), labelY, valueY, 'Verify At', `tivra.in/verify/${opts.verifyCode}`, CYAN)

  drawGradientLine(page, x(200), x(1000), y(772), s(1), 0.2)

  drawCentered(page, `CERT ID: ${opts.verifyCode}`, fontMono, s(11), y(800), WHITE, 0.2, s(4))

  const bytes = await pdfDoc.save()
  // pdf-lib types this Uint8Array<ArrayBufferLike>, which TS's DOM lib
  // won't accept as a Response body (it could theoretically be a
  // SharedArrayBuffer). It never is here, so copy into a fresh, plain
  // ArrayBuffer to satisfy BodyInit without an unsafe cast at the call site.
  return bytes.slice().buffer as ArrayBuffer
}

function drawFooterColumn(
  page: PDFPage, fontRegular: PDFFont, fontBold: PDFFont,
  centerXPos: number, labelY: number, valueY: number, label: string, value: string, valueColor: RGB,
) {
  const labelX = centerXPos - fontRegular.widthOfTextAtSize(label, s(13)) / 2
  page.drawText(label, { x: labelX, y: labelY, size: s(13), font: fontRegular, color: WHITE, opacity: 0.4 })
  const valueX = centerXPos - fontBold.widthOfTextAtSize(value, s(15)) / 2
  page.drawText(value, { x: valueX, y: valueY, size: s(15), font: fontBold, color: valueColor, opacity: 0.8 })
}
