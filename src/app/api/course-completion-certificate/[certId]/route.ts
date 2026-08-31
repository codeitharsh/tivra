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
    .from('course_completions')
    .select(`
      id, issued_at, verification_code, is_revoked,
      profiles!student_id (full_name, email),
      courses!course_id (title)
    `)
    .eq('id', certId)
    .single()

  if (error || !cert || (cert as Record<string, unknown>).is_revoked) {
    return NextResponse.json({ error: 'Certificate not found or revoked' }, { status: 404 })
  }

  const c       = cert as Record<string, unknown>
  const profile = c.profiles as { full_name: string; email: string } | null
  const courseRow = c.courses as { title: string } | { title: string }[] | null
  const course  = Array.isArray(courseRow) ? courseRow[0] : courseRow

  const rawName       = profile?.full_name ?? 'Student'
  const rawCourseTitle = course?.title ?? 'Tivra Self-Paced Course'
  const issuedAt      = new Date(c.issued_at as string)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const verifyCode    = String(c.verification_code ?? c.id).slice(0, 12).toUpperCase()

  const pdfBytes = await generateCertificatePdf({
    eyebrowStyle: 'pill',
    eyebrow: 'COURSE COMPLETION',
    eyebrowColor: 'cyan',
    name: rawName,
    leadLine: 'has successfully completed the self-paced course',
    headline: rawCourseTitle,
    tailLine: 'completing every required lesson in the course',
    issuedAt,
    verifyCode,
  })

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="tivra-course-completion-${verifyCode}.pdf"`,
      'Cache-Control':       'private, no-cache',
    },
  })
}
