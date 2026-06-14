export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSB } from '@supabase/supabase-js'

const admin = createSB(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const { certId } = await params

  const { data: cert, error } = await admin
    .from('certificates')
    .select(`
      id, score_percent, issued_at, verification_code, is_revoked,
      profiles!student_id (full_name, email),
      phases!phase_id (title, phase_number)
    `)
    .eq('id', certId)
    .single()

  if (error || !cert || (cert as Record<string,unknown>).is_revoked) {
    return NextResponse.json({ error: 'Certificate not found or revoked' }, { status: 404 })
  }

  const c          = cert as Record<string, unknown>
  const profile    = c.profiles as { full_name: string; email: string } | null
  const phase      = c.phases   as { title: string; phase_number: number } | null
  const name       = profile?.full_name ?? 'Student'
  const phaseTitle = phase?.title ?? 'Cloud LaunchPad'
  const phaseNum   = phase?.phase_number ?? 1
  const score      = Math.round((c.score_percent as number) ?? 0)
  const issuedAt   = new Date(c.issued_at as string)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const verifyCode = String(c.verification_code ?? c.id).slice(0, 12).toUpperCase()
  const certTitle  = phaseNum === 1 ? 'AWS industry certifications' : 'AWS professional certifications Associate'

  // Generate SVG certificate (works on edge — no native dependencies)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="850" viewBox="0 0 1200 850" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#07080c"/>
      <stop offset="100%" stop-color="#0d0f1c"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#00d4ff"/>
      <stop offset="50%"  stop-color="#3b5bdb"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#00d4ff" stop-opacity="0.6"/>
      <stop offset="50%"  stop-color="#3b5bdb" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.6"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="850" fill="url(#bgGrad)"/>

  <!-- Grid lines -->
  ${Array.from({length:20},(_,i)=>`<line x1="${i*60}" y1="0" x2="${i*60}" y2="850" stroke="#3b5bdb" stroke-opacity="0.06" stroke-width="1"/>`).join('')}
  ${Array.from({length:15},(_,i)=>`<line x1="0" y1="${i*60}" x2="1200" y2="${i*60}" stroke="#3b5bdb" stroke-opacity="0.06" stroke-width="1"/>`).join('')}

  <!-- Outer border -->
  <rect x="24" y="24" width="1152" height="802" rx="16" fill="none" stroke="url(#borderGrad)" stroke-width="1.5"/>
  <rect x="32" y="32" width="1136" height="786" rx="12" fill="none" stroke="#3b5bdb" stroke-opacity="0.15" stroke-width="1"/>

  <!-- Top accent bar -->
  <rect x="24" y="24" width="1152" height="4" rx="2" fill="url(#accentGrad)"/>

  <!-- Corner decorations -->
  <rect x="24" y="24" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="24" y="24" width="4" height="60" fill="url(#accentGrad)"/>
  <rect x="1116" y="24" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="1172" y="24" width="4" height="60" fill="url(#accentGrad)"/>
  <rect x="24" y="822" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="24" y="762" width="4" height="64" fill="url(#accentGrad)"/>
  <rect x="1116" y="822" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="1172" y="762" width="4" height="64" fill="url(#accentGrad)"/>

  <!-- Tivra T-mark (simplified geometric) -->
  <g transform="translate(544, 68)" filter="url(#glow)">
    <polygon points="56,0 112,0 112,16 68,16 68,64 44,64 44,16 0,16 0,0" fill="url(#accentGrad)" opacity="0.9"/>
    <polygon points="44,16 68,16 68,40 44,40" fill="#7c3aed" opacity="0.7"/>
  </g>

  <!-- TIVRA wordmark -->
  <text x="600" y="168" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="28" letter-spacing="14" fill="none" stroke="url(#accentGrad)" stroke-width="0.5">TIVRA</text>
  <text x="600" y="168" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="28" letter-spacing="14" fill="#ffffff" opacity="0.92">TIVRA</text>

  <!-- Rise Beyond -->
  <text x="600" y="194" text-anchor="middle" font-family="Arial, sans-serif" font-weight="300"
    font-size="13" letter-spacing="8" fill="#ffffff" opacity="0.35">RISE BEYOND</text>

  <!-- Divider -->
  <line x1="200" y1="218" x2="1000" y2="218" stroke="url(#accentGrad)" stroke-width="1" opacity="0.4"/>

  <!-- Certificate of Completion -->
  <text x="600" y="278" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
    font-size="22" fill="#ffffff" opacity="0.5" letter-spacing="3">Certificate of Completion</text>

  <!-- "This certifies that" -->
  <text x="600" y="326" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="16" fill="#ffffff" opacity="0.45" letter-spacing="1">This certifies that</text>

  <!-- Student Name -->
  <text x="600" y="402" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
    font-size="54" fill="#ffffff" filter="url(#glow)">${name}</text>
  <line x1="160" y1="420" x2="1040" y2="420" stroke="url(#accentGrad)" stroke-width="1.5" opacity="0.35"/>

  <!-- "has successfully completed" -->
  <text x="600" y="458" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="16" fill="#ffffff" opacity="0.45" letter-spacing="1">has successfully completed</text>

  <!-- Programme name -->
  <text x="600" y="510" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="30" fill="none" stroke="url(#accentGrad)" stroke-width="0.5" letter-spacing="1">Cloud LaunchPad — ${phaseTitle}</text>
  <text x="600" y="510" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="30" fill="#ffffff" letter-spacing="1">Cloud LaunchPad — ${phaseTitle}</text>

  <!-- Certification name -->
  <rect x="300" y="530" width="600" height="44" rx="22" fill="url(#accentGrad)" opacity="0.12"/>
  <rect x="300" y="530" width="600" height="44" rx="22" fill="none" stroke="url(#accentGrad)" stroke-width="1" opacity="0.4"/>
  <text x="600" y="558" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"
    font-size="18" fill="#00d4ff" letter-spacing="1">${certTitle}</text>

  <!-- Score badge -->
  <circle cx="600" cy="634" r="46" fill="none" stroke="url(#accentGrad)" stroke-width="2"/>
  <circle cx="600" cy="634" r="40" fill="url(#accentGrad)" opacity="0.1"/>
  <text x="600" y="628" text-anchor="middle" font-family="Arial Black, sans-serif"
    font-size="28" font-weight="900" fill="#00d4ff">${score}%</text>
  <text x="600" y="648" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="10" fill="#ffffff" opacity="0.45" letter-spacing="2">SCORE</text>

  <!-- Bottom info row -->
  <text x="200" y="728" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="13" fill="#ffffff" opacity="0.4">Issued On</text>
  <text x="200" y="752" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"
    font-size="15" fill="#ffffff" opacity="0.75">${issuedAt}</text>

  <text x="600" y="728" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="13" fill="#ffffff" opacity="0.4">Issued By</text>
  <text x="600" y="752" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="15" fill="#ffffff" opacity="0.75">TIVRA EdTech</text>

  <text x="1000" y="728" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="13" fill="#ffffff" opacity="0.4">Verify At</text>
  <text x="1000" y="752" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"
    font-size="13" fill="#00d4ff" opacity="0.8">tivra.in/verify/${verifyCode}</text>

  <!-- Bottom divider -->
  <line x1="200" y1="772" x2="1000" y2="772" stroke="url(#accentGrad)" stroke-width="1" opacity="0.2"/>

  <!-- Verification code -->
  <text x="600" y="800" text-anchor="middle" font-family="Courier New, monospace"
    font-size="11" fill="#ffffff" opacity="0.2" letter-spacing="4">CERT ID: ${verifyCode}</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type':        'image/svg+xml',
      'Content-Disposition': `inline; filename="tivra-certificate-${verifyCode}.svg"`,
      'Cache-Control':       'private, no-cache',
    },
  })
}
