export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

export default async function CertificatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  // Fetch all certificates for this student
  const { data: certsRaw } = await supabase
    .from('certificates')
    .select('*, phases(title, phase_number)')
    .eq('student_id', user.id)
    .eq('is_revoked', false)
    .order('issued_at')

  const certs = (certsRaw ?? []) as {
    id: string; score_percent: number; issued_at: string
    verification_code: string; phase_id: string
    phases: { title: string; phase_number: number } | null
  }[]

  // Fetch any programme completion certificate(s) — separate from, and
  // in addition to, the per-phase certificates above.
  const { data: completionsRaw } = await supabase
    .from('program_completions')
    .select('*')
    .eq('student_id', user.id)
    .eq('is_revoked', false)
    .order('issued_at')

  const PLAN_LABELS: Record<string, string> = {
    cloud_launchpad: 'Cloud LaunchPad',
    cloud_architect: 'Cloud Architect',
    bundle:          'Cloud LaunchPad + Cloud Architect (Bundle)',
  }

  const completions = (completionsRaw ?? []) as {
    id: string; plan: string; issued_at: string; verification_code: string
  }[]

  const hasCerts = certs.length > 0 || completions.length > 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="My Certificates" subtitle="Earned by passing phase assessments with ≥75%"/>
        <div style={{ padding: '28px', maxWidth: '800px' }}>

          {/* Programme completion certificate(s) — shown above phase certs */}
          {completions.map(comp => (
            <div key={comp.id} style={{ marginBottom: '32px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #1a1408 0%, #1f1810 50%, #2a1c0a 100%)',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: '16px', padding: '40px', textAlign: 'center',
                position: 'relative', overflow: 'hidden',
                marginBottom: '16px',
              }}>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: '420px', height: '220px', borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(245,158,11,0.14) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}/>

                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px', margin: '0 auto 20px',
                  boxShadow: '0 0 40px rgba(245,158,11,0.4)',
                  position: 'relative', zIndex: 1,
                }}>
                  🎓
                </div>

                <div style={{
                  fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: '#f59e0b', marginBottom: '8px', position: 'relative', zIndex: 1, fontWeight: 700,
                }}>
                  Programme Completion Certificate
                </div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '26px',
                  color: '#fff', marginBottom: '4px', position: 'relative', zIndex: 1,
                }}>
                  {profile.full_name}
                </div>
                <div style={{
                  fontSize: '14px', color: 'var(--muted)', marginBottom: '20px',
                  position: 'relative', zIndex: 1,
                }}>
                  {PLAN_LABELS[comp.plan] ?? 'Tivra Programme'}
                </div>
                <div style={{
                  fontSize: '13px', color: '#f59e0b', marginBottom: '20px',
                  position: 'relative', zIndex: 1,
                }}>
                  Issued {new Date(comp.issued_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
                </div>

                <div style={{
                  display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
                  position: 'relative', zIndex: 1,
                }}>
                  <a
                    href={`/api/program-completion-certificate/${comp.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: '13px', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    ⬇ Download PDF
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${comp.verification_code}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: '13px' }}
                  >
                    Share on LinkedIn
                  </a>
                </div>
              </div>

              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                  Verification code — shareable link
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: '12px',
                  background: 'rgba(255,255,255,0.04)', padding: '8px 12px',
                  borderRadius: '6px', color: 'var(--muted)', marginBottom: '8px',
                  letterSpacing: '0.05em', wordBreak: 'break-all',
                }}>
                  {process.env.NEXT_PUBLIC_APP_URL}/verify/{comp.verification_code}
                </div>
                <a
                  href={`/verify/${comp.verification_code}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '12px', color: 'var(--teal)', textDecoration: 'none' }}
                >
                  Verify this certificate →
                </a>
              </div>
            </div>
          ))}

          {/* No certificates yet */}
          {!hasCerts && (
            <div style={{ textAlign: 'center', padding: '60px 40px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'rgba(59,91,219,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '36px', margin: '0 auto 20px',
              }}>🏆</div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 700,
                fontSize: '20px', marginBottom: '8px',
              }}>
                No certificates yet
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
                Complete all modules in a phase and pass the assessment with a score of 75% or higher to earn your certificate.
              </div>
              <Link href="/programs/cloud-launchpad/assessments" className="btn btn-primary" style={{ fontSize: '13px' }}>
                View Assessments →
              </Link>
            </div>
          )}

          {/* Certificate cards */}
          {certs.map(cert => (
            <div key={cert.id} style={{ marginBottom: '24px' }}>
              {/* Certificate visual */}
              <div style={{
                background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0d1a3a 100%)',
                border: '1px solid rgba(59,91,219,0.35)',
                borderRadius: '16px', padding: '40px', textAlign: 'center',
                position: 'relative', overflow: 'hidden',
                marginBottom: '16px',
              }}>
                {/* Background glow */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: '400px', height: '200px', borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(59,91,219,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}/>

                {/* Trophy */}
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b5bdb, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px', margin: '0 auto 20px',
                  boxShadow: '0 0 40px rgba(59,91,219,0.4)',
                  position: 'relative', zIndex: 1,
                }}>
                  🏆
                </div>

                <div style={{
                  fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: 'var(--muted)', marginBottom: '8px', position: 'relative', zIndex: 1,
                }}>
                  Certificate of Completion
                </div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '26px',
                  color: '#fff', marginBottom: '4px', position: 'relative', zIndex: 1,
                }}>
                  {profile.full_name}
                </div>
                <div style={{
                  fontSize: '14px', color: 'var(--muted)', marginBottom: '20px',
                  position: 'relative', zIndex: 1,
                }}>
                  {cert.phases?.title} · Cloud LaunchPad 2026
                </div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '52px',
                  color: 'var(--green)', lineHeight: 1, marginBottom: '8px',
                  position: 'relative', zIndex: 1,
                }}>
                  {Math.round(cert.score_percent)}%
                </div>
                <div style={{
                  fontSize: '13px', color: 'var(--green)', marginBottom: '20px',
                  position: 'relative', zIndex: 1,
                }}>
                  Issued {new Date(cert.issued_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
                </div>

                {/* Action buttons */}
                <div style={{
                  display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
                  position: 'relative', zIndex: 1,
                }}>
                  <a
                    href={`/api/certificate/${cert.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: '13px' }}
                  >
                    ⬇ Download PDF
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${cert.verification_code}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: '13px' }}
                  >
                    Share on LinkedIn
                  </a>
                </div>
              </div>

              {/* Verification */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                  Verification code — shareable link
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: '12px',
                  background: 'rgba(255,255,255,0.04)', padding: '8px 12px',
                  borderRadius: '6px', color: 'var(--muted)', marginBottom: '8px',
                  letterSpacing: '0.05em', wordBreak: 'break-all',
                }}>
                  {process.env.NEXT_PUBLIC_APP_URL}/verify/{cert.verification_code}
                </div>
                <a
                  href={`/verify/${cert.verification_code}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '12px', color: 'var(--teal)', textDecoration: 'none' }}
                >
                  Verify this certificate →
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
