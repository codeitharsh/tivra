export const runtime = 'edge'

import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import PublicNav from '@/components/PublicNav'
import CourseCard, { type CourseCardData } from '@/components/course/CourseCard'
import type { Profile } from '@/types/database'
import { GraduationCap, Compass } from 'lucide-react'

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
    .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills, cover_image_path, price_inr, original_price_inr')
    .eq('status', 'published')
    .order('display_order')

  const courses = (coursesRaw ?? []) as CourseCardData[]

  const courseIds = courses.map(c => c.id)
  const { data: enrolledRaw } = (user && courseIds.length > 0) ? await admin
    .from('course_enrollments')
    .select('course_id')
    .eq('student_id', user.id)
    .in('course_id', courseIds) : { data: [] }

  const enrolledCourseIds = new Set(((enrolledRaw ?? []) as { course_id: string }[]).map(e => e.course_id))

  const body = (
    <div style={{ padding: '28px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(26px,3vw,36px)',
          color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '10px',
        }}>
          Self-paced courses
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--muted)', maxWidth: '560px', lineHeight: 1.6, marginBottom: '16px' }}>
          Work through lessons whenever you like, track your progress, and earn a certificate when you finish.
        </p>
        <Link href="/explore" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600,
          color: 'var(--accent-2)', textDecoration: 'none',
        }}>
          <Compass size={14}/> Browse by skill, technology, or role →
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
          <GraduationCap size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
          <div style={{ fontSize: '14px' }}>No courses available yet. Check back soon.</div>
        </div>
      ) : (
        <div className="r-grid-3">
          {courses.map(c => (
            <CourseCard key={c.id} course={c} enrolled={enrolledCourseIds.has(c.id)}/>
          ))}
        </div>
      )}
    </div>
  )

  if (profile) {
    return (
      <AuthShell profile={profile} title="Self-Paced Courses" subtitle="Structured, self-paced learning with a certificate on completion — open to everyone" noContainer>
        {body}
      </AuthShell>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      {body}
    </div>
  )
}
