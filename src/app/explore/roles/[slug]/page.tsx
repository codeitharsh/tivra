export const runtime = 'edge'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import PublicNav from '@/components/PublicNav'
import CareerPathCheckout from '@/components/career-paths/CareerPathCheckout'
import CourseCard, { type CourseCardData } from '@/components/course/CourseCard'
import type { Profile } from '@/types/database'
import { Briefcase, ChevronRight, Check, Lock } from 'lucide-react'

export default async function CareerPathLandingPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Browsing is public, same precedent as /courses — only buying/learning
  // needs login. The user/profile lookup here is optional: it only
  // decides chrome and per-student purchase state.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile: Profile | null = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = p as Profile | null
  }

  const admin = createAdminClient()
  const { data: pathRow } = await admin
    .from('career_paths')
    .select('id, slug, title, description, skills, price_inr, original_price_inr')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!pathRow) notFound()
  const path = pathRow as {
    id: string; slug: string; title: string; description: string | null
    skills: string[]; price_inr: number | null; original_price_inr: number | null
  }

  const { data: linksRaw } = await admin
    .from('career_path_courses')
    .select(`
      course_id, display_order,
      courses!course_id(id, slug, title, description, difficulty, estimated_duration_minutes, skills, cover_image_path, price_inr, original_price_inr, status)
    `)
    .eq('career_path_id', path.id)
    .order('display_order')

  type CourseRel = CourseCardData & { status: string }
  const courses = ((linksRaw ?? []) as { courses: CourseRel | CourseRel[] | null }[])
    .map(l => Array.isArray(l.courses) ? (l.courses[0] ?? null) : l.courses)
    .filter((c): c is CourseRel => !!c && c.status === 'published')

  const isPaid = !!path.price_inr && path.price_inr > 0
  let owned = !isPaid

  if (user && isPaid) {
    const { data: purchase } = await admin
      .from('career_path_purchases')
      .select('id')
      .eq('student_id', user.id)
      .eq('career_path_id', path.id)
      .maybeSingle()
    owned = !!purchase
  }

  const body = (
    <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>
        <Link href="/explore" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Explore</Link>
        <ChevronRight size={13}/>
        <span style={{ color: 'var(--text)' }}>{path.title}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{
          padding: '32px 32px 24px', background: 'linear-gradient(135deg, var(--accent), #2a2a2a)',
          color: '#fff', display: 'flex', alignItems: 'flex-start', gap: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: 'var(--radius)', flexShrink: 0,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Briefcase size={22}/></div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '6px' }}>
              Career path
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(24px,3vw,32px)', marginBottom: '6px' }}>
              {path.title}
            </h1>
            {path.description && (
              <p style={{ fontSize: '14px', lineHeight: 1.6, opacity: 0.85, maxWidth: '560px' }}>{path.description}</p>
            )}
          </div>
        </div>

        <div style={{ padding: '24px 32px' }}>
          {path.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '22px' }}>
              {path.skills.map(s => (
                <Link key={s} href={`/explore?skill=${encodeURIComponent(s)}`} style={{
                  fontSize: '12px', padding: '4px 11px', borderRadius: '20px', textDecoration: 'none',
                  background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                }}>{s}</Link>
              ))}
            </div>
          )}

          {owned ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--green-text)', fontWeight: 600 }}>
              <Check size={15}/> You own this career path
            </div>
          ) : isPaid ? (
            user ? (
              <CareerPathCheckout
                pathSlug={path.slug} pathTitle={path.title}
                priceInr={path.price_inr!} originalPriceInr={path.original_price_inr}
              />
            ) : (
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '24px', color: 'var(--text)', marginBottom: '10px' }}>
                  {path.original_price_inr && path.original_price_inr > path.price_inr! && (
                    <span style={{ fontSize: '15px', color: 'var(--muted2)', textDecoration: 'line-through', marginRight: '10px' }}>
                      ₹{path.original_price_inr.toLocaleString('en-IN')}
                    </span>
                  )}
                  ₹{path.price_inr!.toLocaleString('en-IN')}
                </div>
                <Link href={`/login?next=/explore/roles/${path.slug}`} className="btn btn-primary" style={{ fontSize: '13px' }}>
                  <Lock size={13}/> Log in to buy
                </Link>
              </div>
            )
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Free — explore every course below individually.</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '4px' }}>
          Mandatory courses ({courses.length})
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Buy the bundle above, or purchase any course individually from its own page.
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          No courses added to this path yet.
        </div>
      ) : (
        <div className="r-grid-3">
          {courses.map(c => <CourseCard key={c.id} course={c}/>)}
        </div>
      )}
    </div>
  )

  if (profile) {
    return (
      <AuthShell profile={profile} title={path.title} subtitle="Career path" noContainer>
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
