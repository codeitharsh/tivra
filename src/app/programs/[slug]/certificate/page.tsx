export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { requireActiveStudent } from '@/lib/access-gate'
import { requireProgramAccess } from '@/lib/program-access'
import type { Profile } from '@/types/database'
import { GraduationCap, Trophy, Download, Share2, ArrowRight } from 'lucide-react'

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  requireActiveStudent(profile)

  const admin = createAdminClient()
  const program = await requireProgramAccess(admin, profile, slug)

  // Fetch certificates for THIS programme only — previously this page
  // fetched every certificate the student had ever earned, across all
  // programmes, with no filter at all. That was fine when only one
  // programme existed; now that students can be entitled to several,
  // each programme's certificate page should show only its own
  // certificates, consistent with how every other [slug] page scopes
  // its data to the resolved programme.
  const { data: phaseIdsRaw } = await admin
    .from('phases')
    .select('id')
    .eq('program_id', program.id)

  const phaseIds = ((phaseIdsRaw ?? []) as { id: string }[]).map(p => p.id)

  const { data: certsRaw } = phaseIds.length > 0 ? await supabase
    .from('certificates')
    .select('*, phases(title, phase_number)')
    .eq('student_id', user.id)
    .eq('is_revoked', false)
    .in('phase_id', phaseIds)
    .order('issued_at') : { data: [] }

  const certs = (certsRaw ?? []) as {
    id: string; score_percent: number; issued_at: string
    verification_code: string; phase_id: string
    phases: { title: string; phase_number: number } | null
  }[]

  // The programme completion certificate is keyed by `plan`, not
  // `program_id` directly (a Bundle spans 2 programmes under one
  // completion cert) — so this still needs the plan-name lookup, but
  // now only shows a completion certificate whose underlying
  // programme(s) include THIS resolved programme. Simplest correct
  // check: does this student have a completion cert whose plan maps
  // to a set of programmes including this one?
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

  // A completion cert is relevant to this page if its program_id
  // matches directly (single-programme plan) OR its phase_ids_completed
  // includes any phase belonging to this programme (covers the Bundle
  // case, where program_id is null but phase_ids_completed spans both).
  const allCompletions = (completionsRaw ?? []) as {
    id: string; plan: string; program_id: string | null
    phase_ids_completed: string[]; issued_at: string; verification_code: string
  }[]

  const completions = allCompletions.filter(c =>
    c.program_id === program.id ||
    c.phase_ids_completed.some(id => phaseIds.includes(id))
  )

  const hasCerts = certs.length > 0 || completions.length > 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="My Certificates" subtitle={`${program.name} — earned by passing phase assessments with ≥75%`}/>
        <div style={{ padding: '28px', maxWidth: '800px' }}>

          {completions.map(comp => (
            <div key={comp.id} style={{ marginBottom: '32px' }}>
              <div className="card" style={{
                borderTop: '2px solid var(--amber)',
                padding: '40px', textAlign: 'center',
                marginBottom: '16px',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--amber-dim)', color: 'var(--amber)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <GraduationCap size={26}/>
                </div>

                <div className="stat-label" style={{ color: 'var(--amber)', marginBottom: '8px', justifyContent: 'center' }}>
                  Programme completion certificate
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px',
                  color: 'var(--text)', marginBottom: '4px',
                }}>
                  {profile.full_name}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
                  {PLAN_LABELS[comp.plan] ?? 'Tivra Programme'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--amber)', marginBottom: '20px' }}>
                  Issued {new Date(comp.issued_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={`/api/program-completion-certificate/${comp.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: '13px', background: 'var(--amber)', borderColor: 'var(--amber)' }}
                  >
                    <Download size={13}/> Download PDF
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${comp.verification_code}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: '13px' }}
                  >
                    <Share2 size={13}/> Share on LinkedIn
                  </a>
                </div>
              </div>

              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                  Verification code — shareable link
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  background: 'var(--card2)', padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)', color: 'var(--muted)', marginBottom: '8px',
                  letterSpacing: '0.02em', wordBreak: 'break-all',
                }}>
                  {process.env.NEXT_PUBLIC_APP_URL}/verify/{comp.verification_code}
                </div>
                <a
                  href={`/verify/${comp.verification_code}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '12px', color: 'var(--accent-2)', textDecoration: 'none' }}
                >
                  Verify this certificate →
                </a>
              </div>
            </div>
          ))}

          {!hasCerts && (
            <div style={{ textAlign: 'center', padding: '60px 40px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: 'var(--radius)',
                background: 'var(--accent-dim)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}><Trophy size={28}/></div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontWeight: 600,
                fontSize: '20px', marginBottom: '8px',
              }}>
                No certificates yet
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
                Complete all modules in a phase and pass the assessment with a score of 75% or higher to earn your certificate.
              </div>
              <Link href={`/programs/${slug}/assessments`} className="btn btn-primary" style={{ fontSize: '13px' }}>
                View assessments <ArrowRight size={13}/>
              </Link>
            </div>
          )}

          {certs.map(cert => (
            <div key={cert.id} style={{ marginBottom: '24px' }}>
              <div className="card" style={{
                borderTop: '2px solid var(--accent)',
                padding: '40px', textAlign: 'center',
                marginBottom: '16px',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-dim)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Trophy size={26}/>
                </div>

                <div className="stat-label" style={{ marginBottom: '8px', justifyContent: 'center' }}>
                  Certificate of completion
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px',
                  color: 'var(--text)', marginBottom: '4px',
                }}>
                  {profile.full_name}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
                  {cert.phases?.title} · {program.name}
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '48px',
                  color: 'var(--green)', lineHeight: 1, marginBottom: '8px',
                }}>
                  {Math.round(cert.score_percent)}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--green)', marginBottom: '20px' }}>
                  Issued {new Date(cert.issued_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={`/api/certificate/${cert.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: '13px' }}
                  >
                    <Download size={13}/> Download PDF
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${cert.verification_code}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: '13px' }}
                  >
                    <Share2 size={13}/> Share on LinkedIn
                  </a>
                </div>
              </div>

              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                  Verification code — shareable link
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  background: 'var(--card2)', padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)', color: 'var(--muted)', marginBottom: '8px',
                  letterSpacing: '0.02em', wordBreak: 'break-all',
                }}>
                  {process.env.NEXT_PUBLIC_APP_URL}/verify/{cert.verification_code}
                </div>
                <a
                  href={`/verify/${cert.verification_code}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '12px', color: 'var(--accent-2)', textDecoration: 'none' }}
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
