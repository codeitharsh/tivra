export const runtime = 'edge'

import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'
import { DEFAULT_PROGRAM_FAQS } from '@/lib/default-faqs'
import ViewCurriculumButton from '@/components/ViewCurriculumButton'
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
  const priceLabel = program.price_inr ? `₹${program.price_inr.toLocaleString('en-IN')}` : 'Revealing Soon'

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
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 100,
        background: 'linear-gradient(90deg,transparent 3%,#00d4ff 25%,#3b5bdb 55%,#7c3aed 80%,transparent 97%)',
      }}/>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '64px',
        padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(7,8,13,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32}/>
          <div style={{
            fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '16px', letterSpacing: '0.08em',
            background: 'linear-gradient(135deg,#00d4ff,#7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>TIVRA</div>
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/login" style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
            padding: '8px 18px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)',
          }}>Login</Link>
          {ENROLLMENT_OPEN ? (
            <Link href="/register" style={{
              fontSize: '13px', color: '#fff', textDecoration: 'none',
              padding: '9px 22px', borderRadius: '100px', fontWeight: 700,
              background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
            }}>Enrol Now</Link>
          ) : (
            <span style={{
              fontSize: '13px', color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed',
              padding: '9px 22px', borderRadius: '100px', fontWeight: 700,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            }}>Enrollments Will Start Soon</span>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: '120px', paddingBottom: '80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(59,91,219,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,91,219,0.05) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}/>
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse,rgba(0,212,255,0.1) 0%,transparent 70%)',
          pointerEvents: 'none',
        }}/>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '5px 14px', borderRadius: '100px',
            background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
            marginBottom: '24px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }}/>
            <span style={{ fontSize: '11px', color: '#00d4ff', fontFamily: 'Space Mono,monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {ENROLLMENT_OPEN ? 'Now Enrolling' : 'Enrollments Will Start Soon'}
            </span>
          </div>

          <h1 style={{
            fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 'clamp(40px,7vw,76px)',
            color: '#fff', letterSpacing: '-0.03em', lineHeight: 0.92, marginBottom: '20px',
          }}>
            {program.name}
          </h1>
          {program.tagline && (
            <div style={{
              fontFamily: 'DM Sans,sans-serif', fontWeight: 300, fontSize: 'clamp(16px,2.5vw,22px)',
              color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em', marginBottom: '28px',
            }}>
              {program.tagline}
            </div>
          )}

          {program.description && (
            <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.55)', maxWidth: '560px', margin: '0 auto 40px', lineHeight: 1.7 }}>
              {program.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '56px' }}>
            {ENROLLMENT_OPEN ? (
              <Link href={`/payment?plan=${program.slug}`} style={{
                padding: '14px 32px', borderRadius: '100px',
                background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 700,
                fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase',
                textDecoration: 'none', boxShadow: '0 6px 28px rgba(59,91,219,0.4)',
              }}>
                Enrol Now →
              </Link>
            ) : (
              <span style={{
                padding: '14px 32px', borderRadius: '100px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.3)', fontFamily: 'Syne,sans-serif', fontWeight: 700,
                fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'not-allowed',
              }}>
                Enrollments Will Start Soon
              </span>
            )}
            <ViewCurriculumButton programSlug={program.slug} programName={program.name}/>
          </div>

          {/* Quick stats */}
          <div style={{
            display: 'inline-flex', gap: '0',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px', overflow: 'hidden',
          }}>
            {[
              { num: program.duration_label ?? '—', label: 'Duration' },
              { num: priceLabel, label: 'Price' },
              { num: '75%', label: 'Pass mark' },
            ].map((s, i, arr) => (
              <div key={s.label} style={{
                padding: '16px 24px', textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{
                  fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '18px',
                  background: 'linear-gradient(135deg,#00d4ff,#7c3aed)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  {s.num}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get — fixed feature grid, no public module-by-module
          curriculum. Get the full outline via the lead-gated PDF above. */}
      <section style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '32px', color: '#fff', textAlign: 'center', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            What you get
          </h2>
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '40px' }}>
            Want the detailed module breakdown? <ViewCurriculumButton programSlug={program.slug} programName={program.name} inline/>
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '14px',
          }}>
            {features.map(f => (
              <div key={f.label} style={{
                padding: '20px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {f.label}
                </div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 40px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '32px', color: '#fff', textAlign: 'center', marginBottom: '36px', letterSpacing: '-0.02em' }}>
            FAQ
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {faqs.map((f, i) => (
              <details key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
                <summary style={{
                  padding: '16px 20px', cursor: 'pointer', listStyle: 'none',
                  fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: '14px', color: '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  {f.q}
                  <span style={{ color: 'rgba(0,212,255,0.7)', fontSize: '18px', flexShrink: 0, marginLeft: '10px' }}>+</span>
                </summary>
                <div style={{ padding: '0 20px 16px', fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 'clamp(28px,5vw,44px)', color: '#fff', letterSpacing: '-0.03em', marginBottom: '14px' }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', marginBottom: '32px' }}>
            {ENROLLMENT_OPEN
              ? 'Register today and unlock your dashboard, live classes, and study notes immediately after payment.'
              : 'Enrollments will start soon. Check back for updates.'}
          </p>
          {ENROLLMENT_OPEN ? (
            <Link href={`/payment?plan=${program.slug}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '15px 36px', borderRadius: '100px',
              background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
              color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 700,
              fontSize: '15px', letterSpacing: '0.05em', textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(59,91,219,0.45)',
            }}>
              Enrol in {program.name} →
            </Link>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '15px 36px', borderRadius: '100px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.3)', fontFamily: 'Syne,sans-serif', fontWeight: 700,
              fontSize: '15px', letterSpacing: '0.05em', cursor: 'not-allowed',
            }}>
              Enrollments Will Start Soon
            </span>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '32px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
          © 2026 Tivra · <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
          {' · '}<Link href="/programs" style={{ color: 'inherit', textDecoration: 'none' }}>All Programmes</Link>
        </div>
      </footer>
    </div>
  )
}
