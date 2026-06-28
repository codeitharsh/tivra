export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSB } from '@supabase/supabase-js'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Same XSS-safe escaping as the per-phase certificate route — required
// any time user-controlled text (here: full_name) is interpolated into SVG.
function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const PLAN_TITLES: Record<string, string> = {
  cloud_launchpad: 'Cloud LaunchPad Programme',
  cloud_architect: 'Cloud Architect Programme',
  bundle:          'Cloud LaunchPad + Cloud Architect Programme',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const { certId } = await params

  const sb = adminSB()
  const { data: cert, error } = await sb
    .from('program_completions')
    .select(`
      id, plan, issued_at, verification_code, is_revoked,
      profiles!student_id (full_name, email)
    `)
    .eq('id', certId)
    .single()

  if (error || !cert || (cert as Record<string,unknown>).is_revoked) {
    return NextResponse.json({ error: 'Certificate not found or revoked' }, { status: 404 })
  }

  const c       = cert as Record<string, unknown>
  const profile = c.profiles as { full_name: string; email: string } | null
  const plan    = String(c.plan ?? 'cloud_launchpad')

  const rawName      = profile?.full_name ?? 'Student'
  const rawPlanTitle = PLAN_TITLES[plan] ?? 'Tivra Programme'
  const issuedAt     = new Date(c.issued_at as string)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const verifyCode   = String(c.verification_code ?? c.id).slice(0, 12).toUpperCase()

  const name      = escapeXml(rawName)
  const planTitle = escapeXml(rawPlanTitle)

  // Same proven layout as the per-phase certificate, with two changes:
  // "Certificate of Completion" → "Programme Completion Certificate"
  // (distinguishing it visually from a phase certificate at a glance),
  // and no score circle, since this certifies the FULL programme, not
  // a single assessment score.
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

  <rect width="1200" height="850" fill="url(#bgGrad)"/>

  ${Array.from({length:20},(_,i)=>`<line x1="${i*60}" y1="0" x2="${i*60}" y2="850" stroke="#3b5bdb" stroke-opacity="0.06" stroke-width="1"/>`).join('')}
  ${Array.from({length:15},(_,i)=>`<line x1="0" y1="${i*60}" x2="1200" y2="${i*60}" stroke="#3b5bdb" stroke-opacity="0.06" stroke-width="1"/>`).join('')}

  <rect x="24" y="24" width="1152" height="802" rx="16" fill="none" stroke="url(#borderGrad)" stroke-width="1.5"/>
  <rect x="32" y="32" width="1136" height="786" rx="12" fill="none" stroke="#3b5bdb" stroke-opacity="0.15" stroke-width="1"/>

  <rect x="24" y="24" width="1152" height="4" rx="2" fill="url(#accentGrad)"/>

  <rect x="24" y="24" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="24" y="24" width="4" height="60" fill="url(#accentGrad)"/>
  <rect x="1116" y="24" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="1172" y="24" width="4" height="60" fill="url(#accentGrad)"/>
  <rect x="24" y="822" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="24" y="762" width="4" height="64" fill="url(#accentGrad)"/>
  <rect x="1116" y="822" width="60" height="4" fill="url(#accentGrad)"/>
  <rect x="1172" y="762" width="4" height="64" fill="url(#accentGrad)"/>

  <g transform="translate(544, 60)" filter="url(#glow)">
    <polygon points="56,0 112,0 112,16 68,16 68,64 44,64 44,16 0,16 0,0" fill="url(#accentGrad)" opacity="0.9"/>
    <polygon points="44,16 68,16 68,40 44,40" fill="#7c3aed" opacity="0.7"/>
  </g>

  <text x="600" y="160" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="28" letter-spacing="14" fill="none" stroke="url(#accentGrad)" stroke-width="0.5">TIVRA</text>
  <text x="600" y="160" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="28" letter-spacing="14" fill="#ffffff" opacity="0.92">TIVRA</text>

  <text x="600" y="186" text-anchor="middle" font-family="Arial, sans-serif" font-weight="300"
    font-size="13" letter-spacing="8" fill="#ffffff" opacity="0.35">RISE BEYOND</text>

  <line x1="200" y1="212" x2="1000" y2="212" stroke="url(#accentGrad)" stroke-width="1" opacity="0.4"/>

  <!-- Gold-ish accent badge to distinguish from a phase certificate at a glance -->
  <rect x="470" y="240" width="260" height="38" rx="19" fill="#f59e0b" opacity="0.12"/>
  <rect x="470" y="240" width="260" height="38" rx="19" fill="none" stroke="#f59e0b" stroke-width="1" opacity="0.5"/>
  <text x="600" y="265" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"
    font-size="14" letter-spacing="2" fill="#f59e0b">PROGRAMME COMPLETION</text>

  <text x="600" y="332" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="16" fill="#ffffff" opacity="0.45" letter-spacing="1">This certifies that</text>

  <text x="600" y="408" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
    font-size="54" fill="#ffffff" filter="url(#glow)">${name}</text>
  <line x1="160" y1="426" x2="1040" y2="426" stroke="url(#accentGrad)" stroke-width="1.5" opacity="0.35"/>

  <text x="600" y="464" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="16" fill="#ffffff" opacity="0.45" letter-spacing="1">has successfully completed the entire</text>

  <text x="600" y="520" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="32" fill="none" stroke="url(#accentGrad)" stroke-width="0.5" letter-spacing="1">${planTitle}</text>
  <text x="600" y="520" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="32" fill="#ffffff" letter-spacing="1">${planTitle}</text>

  <text x="600" y="572" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="16" fill="#ffffff" opacity="0.5" letter-spacing="1">passing every phase assessment required for the programme</text>

  <text x="200" y="700" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="13" fill="#ffffff" opacity="0.4">Issued On</text>
  <text x="200" y="724" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"
    font-size="15" fill="#ffffff" opacity="0.75">${issuedAt}</text>

  <text x="600" y="700" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="13" fill="#ffffff" opacity="0.4">Issued By</text>
  <text x="600" y="724" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900"
    font-size="15" fill="#ffffff" opacity="0.75">TIVRA EdTech</text>

  <text x="1000" y="700" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="13" fill="#ffffff" opacity="0.4">Verify At</text>
  <text x="1000" y="724" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"
    font-size="13" fill="#00d4ff" opacity="0.8">tivra.in/verify/${verifyCode}</text>

  <line x1="200" y1="752" x2="1000" y2="752" stroke="url(#accentGrad)" stroke-width="1" opacity="0.2"/>

  <text x="600" y="790" text-anchor="middle" font-family="Courier New, monospace"
    font-size="11" fill="#ffffff" opacity="0.2" letter-spacing="4">CERT ID: ${verifyCode}</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type':        'image/svg+xml',
      'Content-Disposition': `inline; filename="tivra-programme-completion-${verifyCode}.svg"`,
      'Cache-Control':       'private, no-cache',
    },
  })
}
