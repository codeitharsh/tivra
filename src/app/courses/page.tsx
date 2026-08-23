export const runtime = 'edge'

import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import PublicNav from '@/components/PublicNav'
import type { Profile } from '@/types/database'
import { GraduationCap, Clock, ArrowRight, BarChart3 } from 'lucide-react'

interface CourseRow {
  id: string; slug: string; title: string; description: string | null
  difficulty: string; estimated_duration_minutes: number | null; skills: string[]
}

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: 'Beginner',     color: 'var(--green)',    bg: 'var(--green-dim)' },
  intermediate: { label: 'Intermediate', color: '#f59e0b',         bg: 'rgba(245,158,11,0.1)' },
  advanced:     { label: 'Advanced',     color: 'var(--red)',      bg: 'var(--red-dim)' },
}

export default async function CoursesPage() {
  // Browsing is public — anyone can explore what's on offer (see
  // middleware.ts STEP 1c). Only actually taking a lesson requires
  // login. So the user/profile lookup here is optional, never a
  // redirect — it's used only to decide which chrome to render and
  // whether to show per-student "Continue" state.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile: Profile | null = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = p as Profile | null
  }

  const admin = createAdminClient()
  const { data: coursesRaw } = await admin
    .from('courses')
    .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills')
    .eq('status', 'published')
    .order('display_order')

  const courses = (coursesRaw ?? []) as CourseRow[]

  const courseIds = courses.map(c => c.id)
  const { data: enrolledRaw } = (user && courseIds.length > 0) ? await admin
    .from('course_enrollments')
    .select('course_id')
    .eq('student_id', user.id)
    .in('course_id', courseIds) : { data: [] }

  const enrolledCourseIds = new Set(((enrolledRaw ?? []) as { course_id: string }[]).map(e => e.course_id))

  const body = (
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

      <div className="banner banner-brand" style={{ marginBottom: '24px' }}>
        <GraduationCap size={16} style={{ flexShrink: 0 }}/>
        <div style={{ fontSize: '13px' }}>
          <strong style={{ color: 'var(--text)' }}>Learn at your own pace</strong> — work through
          lessons whenever you like, track your progress, and earn a certificate when you finish.
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
          <GraduationCap size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
          <div style={{ fontSize: '14px' }}>No courses available yet. Check back soon.</div>
        </div>
      ) : (
        <div className="r-grid-2">
          {courses.map(c => {
            const diff = DIFFICULTY_META[c.difficulty] ?? DIFFICULTY_META.beginner
            const enrolled = enrolledCourseIds.has(c.id)
            return (
              <Link key={c.id} href={`/courses/${c.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                <div className="card" style={{ padding: '22px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                      background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <GraduationCap size={16}/>
                    </div>
                    <span className="pill" style={{ background: diff.bg, color: diff.color }}>{diff.label}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '8px' }}>
                    {c.title}
                  </div>
                  {c.description && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '14px', flex: 1 }}>
                      {c.description}
                    </p>
                  )}
                  {c.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      {c.skills.slice(0, 3).map(s => (
                        <span key={s} style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '20px',
                          background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--muted)',
                        }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                    {c.estimated_duration_minutes ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--muted2)' }}>
                        <Clock size={12}/> {Math.round(c.estimated_duration_minutes / 60)}h
                      </span>
                    ) : <span/>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-2)' }}>
                      {enrolled ? <><BarChart3 size={13}/> Continue</> : <>View course <ArrowRight size={13}/></>}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )

  if (profile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar profile={profile}/>
        <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
          <Topbar title="Self-Paced Courses" subtitle="Structured, self-paced learning with a certificate on completion — open to everyone"/>
          {body}
        </main>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      {body}
    </div>
  )
}
