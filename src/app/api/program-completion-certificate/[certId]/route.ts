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

  const pdfBytes = await generateCertificatePdf({
    eyebrowStyle: 'pill',
    eyebrow: 'PROGRAMME COMPLETION',
    eyebrowColor: 'amber',
    name: rawName,
    leadLine: 'has successfully completed the entire',
    headline: rawPlanTitle,
    tailLine: 'passing every phase assessment required for the programme',
    issuedAt,
    verifyCode,
  })

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="tivra-programme-completion-${verifyCode}.pdf"`,
      'Cache-Control':       'private, no-cache',
    },
  })
}
