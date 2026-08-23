export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import { GraduationCap, Download, Share2, Trophy, ArrowRight } from 'lucide-react'

export default async function CourseCertificatePage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const { data: courseRow } = await admin
    .from('courses')
    .select('id, slug, title')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!courseRow) notFound()
  const course = courseRow as { id: string; slug: string; title: string }

  const { data: completionRow } = await admin
    .from('course_completions')
    .select('id, completed_lesson_count, total_required_lesson_count, issued_at, verification_code, is_revoked')
    .eq('student_id', user.id)
    .eq('course_id', course.id)
    .eq('is_revoked', false)
    .maybeSingle()

  const completion = completionRow as {
    id: string; completed_lesson_count: number; total_required_lesson_count: number
    issued_at: string; verification_code: string
  } | null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="Certificate" subtitle={course.title}/>
        <div style={{ padding: '28px', maxWidth: '700px' }}>

          {!completion ? (
            <div style={{ textAlign: 'center', padding: '60px 40px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: 'var(--radius)',
                background: 'var(--accent-dim)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}><Trophy size={28}/></div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>
                No certificate yet
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', maxWidth: '380px', margin: '0 auto 24px' }}>
                Complete every required lesson in this course to earn your certificate.
              </div>
              <Link href={`/courses/${slug}`} className="btn btn-primary" style={{ fontSize: '13px' }}>
                Continue course <ArrowRight size={13}/>
              </Link>
            </div>
          ) : (
            <>
              <div className="card" style={{ borderTop: '2px solid var(--accent-2)', padding: '40px', textAlign: 'center', marginBottom: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <GraduationCap size={26}/>
                </div>

                <div className="stat-label" style={{ marginBottom: '8px', justifyContent: 'center' }}>
                  Course completion certificate
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px', color: 'var(--text)', marginBottom: '4px' }}>
                  {profile.full_name}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
                  {course.title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--accent-2)', marginBottom: '20px' }}>
                  {completion.completed_lesson_count}/{completion.total_required_lesson_count} required lessons · Issued{' '}
                  {new Date(completion.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={`/api/course-completion-certificate/${completion.id}`}
                    target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize: '13px' }}
                  >
                    <Download size={13}/> Download
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/verify/${completion.verification_code}`)}`}
                    target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '13px' }}
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
                  {process.env.NEXT_PUBLIC_APP_URL}/verify/{completion.verification_code}
                </div>
                <a href={`/verify/${completion.verification_code}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: '12px', color: 'var(--accent-2)', textDecoration: 'none' }}>
                  Verify this certificate →
                </a>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
