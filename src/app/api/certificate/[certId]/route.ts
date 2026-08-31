export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSB } from '@supabase/supabase-js'
import { generateCertificatePdf } from '@/lib/certificate-pdf'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const { certId } = await params

  const sb = adminSB()
  const { data: cert, error } = await sb
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

  const rawName       = profile?.full_name ?? 'Student'
  const rawPhaseTitle = phase?.title ?? 'Cloud LaunchPad'
  const phaseNum      = phase?.phase_number ?? 1
  const score         = Math.round((c.score_percent as number) ?? 0)
  const issuedAt      = new Date(c.issued_at as string)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const verifyCode    = String(c.verification_code ?? c.id).slice(0, 12).toUpperCase()

  // Real certification names — phase 1 is the Cloud Practitioner track,
  // phase 2 is the Solutions Architect track. (Previously this held garbled
  // placeholder text left over from an earlier find-replace pass.)
  const rawCertTitle = phaseNum === 1
    ? 'AWS Cloud Practitioner'
    : 'AWS Solutions Architect Associate'

  const pdfBytes = await generateCertificatePdf({
    eyebrowStyle: 'plain',
    eyebrow: 'Certificate of Completion',
    name: rawName,
    leadLine: 'has successfully completed',
    headline: rawPhaseTitle,
    badgeText: rawCertTitle,
    statValue: `${score}%`,
    statLabel: 'SCORE',
    issuedAt,
    verifyCode,
  })

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="tivra-certificate-${verifyCode}.pdf"`,
      'Cache-Control':       'private, no-cache',
    },
  })
}
