export const runtime = 'edge'

import Image from 'next/image'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import PublicNav from '@/components/PublicNav'
import ExploreSearchBar from '@/components/explore/ExploreSearchBar'
import { courseAssetUrl } from '@/lib/course-assets'
import type { Profile } from '@/types/database'
import { Compass, GraduationCap, Briefcase, Clock, ArrowRight, BarChart3, X } from 'lucide-react'

interface CourseRow {
  id: string; slug: string; title: string; description: string | null
  difficulty: string; estimated_duration_minutes: number | null; skills: string[]
  cover_image_path: string | null
  price_inr: number | null; original_price_inr: number | null
}
interface PathRow {
  id: string; slug: string; title: string; description: string | null
  skills: string[]; price_inr: number | null; original_price_inr: number | null
}

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: 'Beginner',     color: 'var(--green-text)', bg: 'var(--green-dim)' },
  intermediate: { label: 'Intermediate', color: 'var(--amber-text)', bg: 'var(--amber-dim)' },
  advanced:     { label: 'Advanced',     color: 'var(--red-text)',   bg: 'var(--red-dim)' },
}

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

  const allCourses = (coursesRaw ?? []) as CourseRow[]
  const allPaths   = (pathsRaw ?? []) as PathRow[]

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
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

      <div className="banner banner-brand" style={{ marginBottom: '20px' }}>
        <Compass size={16} style={{ flexShrink: 0 }}/>
        <div style={{ fontSize: '13px' }}>
          <strong style={{ color: 'var(--text)' }}>Explore by skill, technology, or role</strong> — find a
          single course, or a bundled career path with everything mandatory for the job.
        </div>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <ExploreSearchBar initialQuery={q}/>
      </div>

      {allSkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '28px' }}>
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
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={16} color="var(--accent-2)"/> Browse by role
          </div>
          <div className="r-grid-2">
            {filteredPaths.map(p => (
              <Link key={p.id} href={`/explore/roles/${p.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                <div className="card card-hover" style={{ padding: '22px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                      background: 'var(--accent-dim)', color: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Briefcase size={16}/>
                    </div>
                    {p.price_inr ? (
                      <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                        ₹{p.price_inr.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="pill" style={{ background: 'var(--green-dim)', color: 'var(--green-text)' }}>Free</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '8px' }}>
                    {p.title}
                  </div>
                  {p.description && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '14px', flex: 1 }}>
                      {p.description}
                    </p>
                  )}
                  {p.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {p.skills.slice(0, 4).map(s => (
                        <span key={s} style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '20px',
                          background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--muted)',
                        }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-2)', marginTop: 'auto' }}>
                    View career path <ArrowRight size={13}/>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Courses ── */}
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={16} color="var(--accent-2)"/> Courses
        </div>

        {filteredCourses.length === 0 && filteredPaths.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
            <GraduationCap size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
            <div style={{ fontSize: '14px' }}>Nothing matches that search. Try a different term or clear the filter.</div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0' }}>No individual courses match — see the role bundle above.</div>
        ) : (
          <div className="r-grid-2">
            {filteredCourses.map(c => {
              const diff = DIFFICULTY_META[c.difficulty] ?? DIFFICULTY_META.beginner
              const enrolled = enrolledCourseIds.has(c.id)
              return (
                <Link key={c.id} href={`/courses/${c.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div className="card card-hover" style={{ padding: '22px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {c.cover_image_path && (
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '14px' }}>
                        <Image src={courseAssetUrl(c.cover_image_path)} alt={c.title} fill style={{ objectFit: 'cover', objectPosition: 'top' }}/>
                      </div>
                    )}
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
                    {c.price_inr && c.price_inr > 0 && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                        {c.original_price_inr && c.original_price_inr > c.price_inr && (
                          <span style={{ fontSize: '12px', color: 'var(--muted2)', textDecoration: 'line-through' }}>
                            ₹{c.original_price_inr.toLocaleString('en-IN')}
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                          ₹{c.price_inr.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
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
