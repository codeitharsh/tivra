export const runtime = 'edge'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import PublicNav from '@/components/PublicNav'
import { createAdminClient } from '@/lib/supabase/server'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'
import { DEFAULT_PROGRAM_FAQS } from '@/lib/default-faqs'
import ViewCurriculumButton from '@/components/ViewCurriculumButton'
import { priceNode } from '@/lib/format-price'
import type { Program } from '@/types/database'

export default async function ProgramLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: programRow } = await admin
    .from('programs')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!programRow) notFound()
  const program = programRow as Program

  const faqs = program.faqs && program.faqs.length > 0 ? program.faqs : DEFAULT_PROGRAM_FAQS

  // Fixed feature grid — no per-module curriculum is shown publicly
  // anymore (see "View Curriculum" for the lead-gated PDF instead).
  // Live Classes / Hands-on Projects / Career Guidance / Certificate
  // are platform-wide facts true of every programme; Placement
  // Assistance only shows when the programme actually offers it.
  const features = [
    { label: 'Duration', value: program.duration_label ?? '—' },
    { label: 'Mode', value: program.mode },
    { label: 'Level', value: program.difficulty ? program.difficulty[0].toUpperCase() + program.difficulty.slice(1) : '—' },
    { label: 'Live Classes', value: 'Included' },
    { label: 'Hands-on Projects', value: 'Included' },
    { label: 'Career Guidance', value: 'Included' },
    { label: 'Certificate', value: 'On completion' },
    ...(program.placement_assistance ? [{ label: 'Placement Assistance', value: 'Included' }] : []),
  ]

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', overflowX: 'hidden' }}>
      <PublicNav/>

      {/* Hero */}
      <section style={{ padding: 'clamp(56px,8vw,88px) clamp(20px,4vw,40px) 64px', textAlign: 'center' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
            marginBottom: '28px',
          }}>
            <span className={`pulse-dot ${ENROLLMENT_OPEN ? 'pulse-green' : 'pulse-red'}`}/>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {ENROLLMENT_OPEN ? 'Now Enrolling' : 'Enrollments Will Start Soon'}
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: 'clamp(2.4rem,6vw,4.4rem)',
            color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.02, marginBottom: '18px',
          }}>
            {program.name}
          </h1>
          {program.tagline && (
            <div style={{ fontSize: 'clamp(15px,2vw,19px)', color: 'var(--muted)', marginBottom: '28px' }}>
              {program.tagline}
            </div>
          )}

          {program.description && (
            <p style={{ fontSize: '16px', color: 'var(--muted)', maxWidth: '560px', margin: '0 auto 40px', lineHeight: 1.7 }}>
              {program.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '48px' }}>
            {ENROLLMENT_OPEN ? (
              <Link href={`/payment?plan=${program.slug}`} className="btn btn-primary">Enrol Now</Link>
            ) : (
              <span className="btn" style={{ background: 'var(--card2)', color: 'var(--muted2)', cursor: 'not-allowed' }}>
                Enrollments Will Start Soon
              </span>
            )}
            <ViewCurriculumButton programSlug={program.slug} programName={program.name}/>
          </div>

          {/* Quick stats */}
          <div className="tv-clip" style={{
            display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            {[
              { num: program.duration_label ?? '—', label: 'Duration' },
              { num: priceNode(program.price_inr, program.original_price_inr), label: 'Price' },
              { num: '75%', label: 'Pass Mark' },
            ].map((s, i, arr) => (
              <div key={s.label} style={{
                padding: '16px 26px', textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '19px', color: 'var(--text)' }}>
                  {s.num}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px', fontFamily: 'var(--font-mono), monospace' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section style={{ borderTop: '1px solid var(--border)', padding: 'clamp(56px,7vw,80px) clamp(20px,4vw,40px)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', color: 'var(--text)', textAlign: 'center', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            What you get
          </h2>
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted2)', marginBottom: '40px' }}>
            Want the detailed module breakdown? <ViewCurriculumButton programSlug={program.slug} programName={program.name} inline/>
          </p>
          <div className="tv-clip" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {features.map(f => (
              <div key={f.label} style={{ padding: '20px', background: 'var(--card)' }}>
                <div style={{ fontSize: '10px', color: 'var(--muted2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'var(--font-mono), monospace' }}>
                  {f.label}
                </div>
                <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '16px', color: 'var(--text)' }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ borderTop: '1px solid var(--border)', padding: 'clamp(56px,7vw,80px) clamp(20px,4vw,40px)' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: 'clamp(1.6rem,3.5vw,2.2rem)', color: 'var(--text)', textAlign: 'center', marginBottom: '36px', letterSpacing: '-0.02em' }}>
            FAQ
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {faqs.map((f, i) => (
              <details key={i} className="faq-details" style={{ borderTop: '1px solid var(--border)' }}>
                <summary style={{
                  padding: '18px 4px', cursor: 'pointer', listStyle: 'none',
                  fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '15px', color: 'var(--text)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                }}>
                  {f.q}
                  <Plus size={16} className="faq-icon" style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                </summary>
                <div style={{ padding: '0 4px 18px', fontSize: '14px', color: 'var(--muted)', lineHeight: 1.7 }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: '1px solid var(--border)', padding: 'clamp(56px,7vw,80px) clamp(20px,4vw,40px)', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: 'clamp(1.8rem,4.5vw,2.6rem)', color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '14px' }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '32px' }}>
            {ENROLLMENT_OPEN
              ? 'Register today and unlock your dashboard, live classes, and study notes immediately after payment.'
              : 'Enrollments will start soon. Check back for updates.'}
          </p>
          {ENROLLMENT_OPEN ? (
            <Link href={`/payment?plan=${program.slug}`} className="btn btn-primary">Enrol in {program.name}</Link>
          ) : (
            <span className="btn" style={{ background: 'var(--card2)', color: 'var(--muted2)', cursor: 'not-allowed' }}>
              Enrollments Will Start Soon
            </span>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted2)' }}>
          © 2026 Tivra · <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
          {' · '}<Link href="/programs" style={{ color: 'inherit', textDecoration: 'none' }}>All Programmes</Link>
        </div>
      </footer>

      <style>{`
        .faq-details[open] .faq-icon { transform: rotate(45deg); }
        .faq-icon { transition: transform 0.2s ease; }
        .faq-details summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  )
}
