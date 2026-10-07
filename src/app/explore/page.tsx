export const runtime = 'edge'

import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import PublicNav from '@/components/PublicNav'
import ExploreSearchBar from '@/components/explore/ExploreSearchBar'
import CourseCard, { type CourseCardData } from '@/components/course/CourseCard'
import RoleBundleCard, { type RoleBundleCardData } from '@/components/career-paths/RoleBundleCard'
import type { Profile } from '@/types/database'
import { GraduationCap, Briefcase, X } from 'lucide-react'

function matchesQuery(q: string, ...fields: (string | null)[]): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return fields.some(f => f?.toLowerCase().includes(needle))
}

export default async function ExplorePage({
  searchParams,
}: { searchParams: Promise<{ q?: string; skill?: string }> }) {
  const { q = '', skill = '' } = await searchParams

  // Browsing is public, same precedent as /courses and /explore/roles — only
  // buying/learning needs login.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile: Profile | null = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = p as Profile | null
  }

  const admin = createAdminClient()
  const [{ data: coursesRaw }, { data: pathsRaw }] = await Promise.all([
    admin.from('courses')
      .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills, cover_image_path, price_inr, original_price_inr')
      .eq('status', 'published').order('display_order'),
    admin.from('career_paths')
      .select('id, slug, title, description, skills, price_inr, original_price_inr')
      .eq('status', 'published').order('display_order'),
  ])

  const allCourses = (coursesRaw ?? []) as CourseCardData[]
  const allPaths   = (pathsRaw ?? []) as RoleBundleCardData[]

  const courseIds = allCourses.map(c => c.id)
  const { data: enrolledRaw } = (user && courseIds.length > 0) ? await admin
    .from('course_enrollments').select('course_id').eq('student_id', user.id).in('course_id', courseIds) : { data: [] }
  const enrolledCourseIds = new Set(((enrolledRaw ?? []) as { course_id: string }[]).map(e => e.course_id))

  // One shared tag list for both "skill" and "technology" browsing —
  // courses.skills already covers both lenses (e.g. "Data Analysis" and
  // "Python" sit side by side), per the confirmed decision not to add a
  // second taxonomy.
  const allSkills = Array.from(new Set([
    ...allCourses.flatMap(c => c.skills),
    ...allPaths.flatMap(p => p.skills),
  ])).sort((a, b) => a.localeCompare(b))

  const filteredCourses = allCourses.filter(c =>
    (!skill || c.skills.includes(skill)) && matchesQuery(q, c.title, c.description)
  )
  const filteredPaths = allPaths.filter(p =>
    (!skill || p.skills.includes(skill)) && matchesQuery(q, p.title, p.description)
  )

  function skillHref(s: string): string {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (s !== skill) params.set('skill', s)
    const qs = params.toString()
    return `/explore${qs ? `?${qs}` : ''}`
  }

  const body = (
    <div style={{ padding: '28px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>

      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 32px' }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(28px,3.5vw,40px)',
          color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '12px',
        }}>
          What do you want to learn?
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px' }}>
          Explore by skill, technology, or role — find a single course, or a bundled
          career path with everything mandatory for the job.
        </p>
        <ExploreSearchBar initialQuery={q}/>
      </div>

      {allSkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginBottom: '40px' }}>
          {skill && (
            <Link href={skillHref(skill)} className="pill" style={{
              background: 'var(--accent)', color: '#fff', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}>
              {skill} <X size={11}/>
            </Link>
          )}
          {allSkills.filter(s => s !== skill).map(s => (
            <Link key={s} href={skillHref(s)} className="pill" style={{
              background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none',
            }}>
              {s}
            </Link>
          ))}
        </div>
      )}

      {/* ── Browse by role ── */}
      {filteredPaths.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '19px', color: 'var(--text)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={17} color="var(--accent-2)"/> Browse by role
          </div>
          <div className="r-grid-3">
            {filteredPaths.map(p => <RoleBundleCard key={p.id} path={p}/>)}
          </div>
        </div>
      )}

      {/* ── Courses ── */}
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '19px', color: 'var(--text)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={17} color="var(--accent-2)"/> Courses
        </div>

        {filteredCourses.length === 0 && filteredPaths.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
            <GraduationCap size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
            <div style={{ fontSize: '14px' }}>Nothing matches that search. Try a different term or clear the filter.</div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0' }}>No individual courses match — see the role bundle above.</div>
        ) : (
          <div className="r-grid-3">
            {filteredCourses.map(c => (
              <CourseCard key={c.id} course={c} enrolled={enrolledCourseIds.has(c.id)}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (profile) {
    return (
      <AuthShell profile={profile} title="Explore" subtitle="Browse by skill, technology, or role" noContainer>
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
