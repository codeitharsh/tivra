export const runtime = 'edge'

import { createClient as createSB } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, XCircle } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  cloud_launchpad: 'Cloud LaunchPad',
  cloud_architect: 'Cloud Architect',
  bundle:          'Cloud LaunchPad + Cloud Architect (Bundle)',
}

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const admin = createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Try a per-phase certificate first...
  const { data: phaseCertData } = await admin
    .from('certificates')
    .select('*, profiles!student_id(full_name), phases!phase_id(title, phase_number)')
    .eq('verification_code', code)
    .maybeSingle()

  // ...fall back to a programme completion certificate if no phase cert matched.
  const { data: completionData } = phaseCertData ? { data: null } : await admin
    .from('program_completions')
    .select('*, profiles!student_id(full_name)')
    .eq('verification_code', code)
    .maybeSingle()

  const isCompletion = !phaseCertData && !!completionData
  const cert    = (phaseCertData ?? completionData) as Record<string,unknown> | null
  const valid   = !!cert && !cert.is_revoked
  const profile = cert?.profiles as { full_name: string } | null
  const phase   = !isCompletion ? (cert?.phases as { title: string; phase_number: number } | null) : null

  return (
    <div style={{
      minHeight:'100vh', background:'var(--bg)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
    }}>
      <div style={{ maxWidth:'480px', width:'100%', textAlign:'center' }}>
        <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:'10px', textDecoration:'none', marginBottom:'36px', justifyContent:'center' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={40} height={40} />
          <span style={{ fontFamily:'var(--font-sans)', fontWeight:700, fontSize:'18px', color:'var(--text)', letterSpacing:'0.04em' }}>
            TIVRA
          </span>
        </Link>

        <div className="card" style={{
          background: valid ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${valid ? 'rgba(74,222,128,0.25)' : 'rgba(240,69,58,0.2)'}`,
          padding:'40px',
        }}>
          {valid ? <CheckCircle2 size={40} color="var(--green)" style={{ marginBottom:'16px' }}/>
                 : <XCircle size={40} color="var(--red)" style={{ marginBottom:'16px' }}/>}
          <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'22px',
            color: valid ? 'var(--green)' : 'var(--red)', marginBottom:'8px' }}>
            {valid
              ? (isCompletion ? 'Programme completion verified' : 'Certificate verified')
              : cert?.is_revoked ? 'Certificate revoked' : 'Certificate not found'}
          </div>

          {valid && cert && !isCompletion && (
            <div style={{ marginTop:'20px', display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                ['Student',   profile?.full_name ?? '—'],
                ['Program',   'Cloud LaunchPad · Tivra'],
                ['Phase',     phase ? `Phase ${phase.phase_number}: ${phase.title}` : '—'],
                ['Score',     `${Math.round(cert.score_percent as number)}%`],
                ['Issued',    new Date(cert.issued_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display:'flex', justifyContent:'space-between', padding:'10px 14px',
                  background:'var(--card2)', borderRadius:'var(--radius-sm)', fontSize:'13px',
                }}>
                  <span style={{ color:'var(--muted)' }}>{label}</span>
                  <span style={{ color:'var(--text)', fontWeight:500 }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {valid && cert && isCompletion && (
            <div style={{ marginTop:'20px', display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                ['Student',   profile?.full_name ?? '—'],
                ['Programme', PLAN_LABELS[String(cert.plan)] ?? 'Tivra Programme'],
                ['Status',    'All phase assessments passed'],
                ['Issued',    new Date(cert.issued_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display:'flex', justifyContent:'space-between', padding:'10px 14px',
                  background:'var(--card2)', borderRadius:'var(--radius-sm)', fontSize:'13px',
                }}>
                  <span style={{ color:'var(--muted)' }}>{label}</span>
                  <span style={{ color:'var(--text)', fontWeight:500 }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {!valid && (
            <div style={{ fontSize:'14px', color:'var(--muted)', marginTop:'12px' }}>
              {cert?.is_revoked
                ? 'This certificate has been revoked by the institution.'
                : 'No certificate found with this verification code. Please check the URL and try again.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
