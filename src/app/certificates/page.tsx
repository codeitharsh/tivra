export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import { Trophy, GraduationCap, Award, Download, Share2 } from 'lucide-react'

// A single hub for every certificate a student has earned — phase
// certificates and programme completions (paid programmes) plus
// self-paced course completions, which previously had no discoverable
// home of their own: the only "Certificate" nav entries were scoped
// per-enrolled-programme, so a student with zero paid programmes (or
// one who just hadn't looked under a specific programme) had no way to
// find a course certificate except knowing its direct URL.

const PLAN_LABELS: Record<string, string> = {
  cloud_launchpad: 'Cloud LaunchPad',
  cloud_architect: 'Cloud Architect',
  bundle:          'Cloud LaunchPad + Cloud Architect (Bundle)',
}

interface PhaseCert {
  id: string; score_percent: number; issued_at: string; verification_code: string
  phases: { title: string; phase_number: number; programs: { name: string } | { name: string }[] | null } | null
}
interface ProgramCompletion {
  id: string; plan: string; issued_at: string; verification_code: string
}
interface CourseCompletion {
  id: string; completed_lesson_count: number; total_required_lesson_count: number
  issued_at: string; verification_code: string
  courses: { title: string; slug: string } | { title: string; slug: string }[] | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

export default async function CertificatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  const [{ data: phaseCertsRaw }, { data: programCompletionsRaw }, { data: courseCompletionsRaw }] = await Promise.all([
    admin.from('certificates')
      .select('id, score_percent, issued_at, verification_code, phases!phase_id(title, phase_number, programs!program_id(name))')
      .eq('student_id', user.id).eq('is_revoked', false).order('issued_at', { ascending: false }),
    admin.from('program_completions')
      .select('id, plan, issued_at, verification_code')
      .eq('student_id', user.id).eq('is_revoked', false).order('issued_at', { ascending: false }),
    admin.from('course_completions')
      .select('id, completed_lesson_count, total_required_lesson_count, issued_at, verification_code, courses!course_id(title, slug)')
      .eq('student_id', user.id).eq('is_revoked', false).order('issued_at', { ascending: false }),
  ])

  const phaseCerts          = (phaseCertsRaw ?? []) as PhaseCert[]
  const programCompletions  = (programCompletionsRaw ?? []) as ProgramCompletion[]
  const courseCompletions   = (courseCompletionsRaw ?? []) as CourseCompletion[]
  const hasAny = phaseCerts.length + programCompletions.length + courseCompletions.length > 0

  const cardStyle: React.CSSProperties = {
    borderTop: '2px solid var(--accent)', padding: '32px', textAlign: 'center', marginBottom: '14px',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="My Certificates" subtitle="Every certificate you've earned on Tivra, in one place"/>
        <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

          {!hasAny && (
            <div style={{ textAlign: 'center', padding: '60px 40px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: 'var(--radius)',
                background: 'var(--accent-dim)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}><Trophy size={28}/></div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>
                No certificates yet
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '420px', margin: '0 auto' }}>
                Pass a phase assessment in a paid programme, or complete every required lesson in a
                self-paced course, and your certificate will show up here.
              </div>
            </div>
          )}

          {courseCompletions.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={16} color="var(--accent-2)"/> Self-Paced Courses
              </div>
              {courseCompletions.map(comp => {
                const course = one(comp.courses)
                return (
                  <div key={comp.id}>
                    <div className="card" style={{ ...cardStyle, borderTopColor: 'var(--accent-2)' }}>
                      <div style={{
                        width: '52px', height: '52px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                      }}><GraduationCap size={24}/></div>
                      <div className="stat-label" style={{ marginBottom: '6px', justifyContent: 'center' }}>Course completion certificate</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '4px' }}>
                        {course?.title ?? 'Tivra Self-Paced Course'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--accent-2)', marginBottom: '16px' }}>
                        {comp.completed_lesson_count}/{comp.total_required_lesson_count} required lessons · Issued {formatDate(comp.issued_at)}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a href={`/api/course-completion-certificate/${comp.id}`} target="_blank" rel="noreferrer"
                          className="btn btn-primary" style={{ fontSize: '13px' }}><Download size={13}/> Download</a>
                        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${comp.verification_code}`)}`}
                          target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '13px' }}><Share2 size={13}/> Share</a>
                        {course?.slug && (
                          <Link href={`/courses/${course.slug}/certificate`} className="btn btn-ghost" style={{ fontSize: '13px' }}>View page</Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {programCompletions.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={16} color="var(--amber)"/> Programme Completion
              </div>
              {programCompletions.map(comp => (
                <div key={comp.id} className="card" style={{ ...cardStyle, borderTopColor: 'var(--amber)' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--amber-dim)', color: 'var(--amber)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                  }}><GraduationCap size={24}/></div>
                  <div className="stat-label" style={{ marginBottom: '6px', justifyContent: 'center' }}>Programme completion certificate</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '4px' }}>
                    {PLAN_LABELS[comp.plan] ?? 'Tivra Programme'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--amber)', marginBottom: '16px' }}>
                    Issued {formatDate(comp.issued_at)}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href={`/api/program-completion-certificate/${comp.id}`} target="_blank" rel="noreferrer"
                      className="btn btn-primary" style={{ fontSize: '13px', background: 'var(--amber)', borderColor: 'var(--amber)' }}><Download size={13}/> Download</a>
                    <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${comp.verification_code}`)}`}
                      target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '13px' }}><Share2 size={13}/> Share</a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {phaseCerts.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={16} color="var(--accent)"/> Phase Certificates
              </div>
              {phaseCerts.map(cert => {
                const phase = one(cert.phases)
                const program = phase ? one(phase.programs) : null
                return (
                  <div key={cert.id} className="card" style={cardStyle}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-dim)', color: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                    }}><Trophy size={24}/></div>
                    <div className="stat-label" style={{ marginBottom: '6px', justifyContent: 'center' }}>Certificate of completion</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                      {program?.name ?? 'Tivra Programme'} — {phase ? `Phase ${phase.phase_number}: ${phase.title}` : ''}
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '32px', color: 'var(--green)', marginBottom: '4px' }}>
                      {Math.round(cert.score_percent)}%
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--green)', marginBottom: '16px' }}>Issued {formatDate(cert.issued_at)}</div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <a href={`/api/certificate/${cert.id}`} target="_blank" rel="noreferrer"
                        className="btn btn-primary" style={{ fontSize: '13px' }}><Download size={13}/> Download</a>
                      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${cert.verification_code}`)}`}
                        target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '13px' }}><Share2 size={13}/> Share</a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
