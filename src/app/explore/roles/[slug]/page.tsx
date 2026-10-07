export const runtime = 'edge'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import PublicNav from '@/components/PublicNav'
import CareerPathCheckout from '@/components/career-paths/CareerPathCheckout'
import type { Profile } from '@/types/database'
import { BookOpen, ChevronRight, ArrowRight, Check, Lock } from 'lucide-react'

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
    .select('course_id, display_order, courses!course_id(id, slug, title, description, status)')
    .eq('career_path_id', path.id)
    .order('display_order')

  type CourseRel = { id: string; slug: string; title: string; description: string | null; status: string }
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
    <div style={{ padding: '28px', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>
        <Link href="/explore" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Explore</Link>
        <ChevronRight size={13}/>
        <span style={{ color: 'var(--text)' }}>{path.title}</span>
      </div>

      <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
        <div className="stat-label" style={{ marginBottom: '10px' }}>Career path</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px', color: 'var(--text)', marginBottom: '10px' }}>
          {path.title}
        </h1>
        {path.description && (
          <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '20px' }}>
            {path.description}
          </p>
        )}
        {path.skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '22px' }}>
            {path.skills.map(s => (
              <span key={s} style={{
                fontSize: '12px', padding: '4px 11px', borderRadius: '20px',
                background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
              }}>{s}</span>
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px' }}>
            Mandatory courses ({courses.length})
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Buy the bundle above, or purchase any course individually from its own page.
          </div>
        </div>
        {courses.map((c, i) => (
          <Link key={c.id} href={`/courses/${c.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px',
              borderBottom: i < courses.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><BookOpen size={14}/></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{c.title}</div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }}/>
            </div>
          </Link>
        ))}
        {courses.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
            No courses added to this path yet.
          </div>
        )}
      </div>
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
