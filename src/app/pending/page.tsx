export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import SignOutButton from './SignOutButton'

import type { Profile, Program } from '@/types/database'

const PALETTE = [
  { color: '#00d4ff', rgb: '0,212,255' },
  { color: '#7c3aed', rgb: '124,58,237' },
  { color: '#22c55e', rgb: '34,197,94' },
  { color: '#f59e0b', rgb: '245,158,11' },
]

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner:     'Beginner friendly',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile) redirect('/login')

  // If somehow active, redirect to dashboard
  if (profile.access_status === 'active') redirect('/dashboard')

  // ── Real programmes, queried from the database ────────────────
  // Previously this page used a hardcoded array of exactly 2
  // programmes — duplicating data that belongs in the `programs`
  // table and silently drifting out of sync with it (e.g. it would
  // never show a 3rd programme added later, and didn't show learning
  // outcomes or instructor info at all because the schema didn't have
  // columns for them — see migrations/2026-07-program-explore-metadata.sql,
  // which added price_inr, duration_label, difficulty, instructor_*,
  // and learning_outcomes so this page can be genuinely DB-driven,
  // matching the same pattern used everywhere else in this codebase
  // (proxy.ts, the /programs/[slug] routes).
  const admin = createAdminClient()
  const { data: programsRaw } = await admin
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const programmes = (programsRaw ?? []) as Program[]

  // Check if they have a pending payment request
  const { data: paymentReq } = await supabase
    .from('payment_requests')
    .select('id, status, created_at, transaction_ref')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const pr = paymentReq as { id: string; status: string; created_at: string; transaction_ref: string } | null
  const hasPendingRequest = pr?.status === 'pending'
  const isRejected        = pr?.status === 'rejected'

  return (
    <div style={{ minHeight: '100vh', background: '#07080c' }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32} />
          <div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '15px',
              letterSpacing: '0.08em',
              background: 'linear-gradient(135deg,#00d4ff,#7c3aed)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text' }}>TIVRA</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.14em', textTransform: 'uppercase' }}>Rise Beyond</div>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
            {profile.full_name ?? profile.email}
          </span>
          <SignOutButton/>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Payment status banner — only shown if relevant, otherwise this
            whole section collapses so the explore content is front and center */}
        {(hasPendingRequest || isRejected) && (
          <div style={{
            background: hasPendingRequest ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${hasPendingRequest ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
            borderRadius: '14px', padding: '18px 22px', marginBottom: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px',
                color: hasPendingRequest ? '#f59e0b' : '#ef4444', marginBottom: '4px',
              }}>
                {hasPendingRequest ? '⏳ Payment Under Review' : '❌ Payment Not Verified'}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                {hasPendingRequest
                  ? "You'll receive access within 24 hours on working days."
                  : <>Couldn&apos;t verify your payment. <a href="mailto:contact@tivra.in" style={{ color: '#00d4ff' }}>Contact us</a> or resubmit below.</>}
              </div>
            </div>
            {isRejected && (
              <Link href="/payment" style={{
                flexShrink: 0, padding: '10px 20px', borderRadius: '100px',
                background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 700,
                fontSize: '13px', textDecoration: 'none',
              }}>
                Resubmit Payment →
              </Link>
            )}
          </div>
        )}

        {/* Hero — explore framing, not a payment wall */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '100px', marginBottom: '20px',
            background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#00d4ff', letterSpacing: '0.06em' }}>
              👋 WELCOME TO TIVRA
            </span>
          </div>
          <h1 style={{
            fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: 'clamp(28px,5vw,40px)', color: '#fff',
            letterSpacing: '-0.02em', marginBottom: '14px', lineHeight: 1.15,
          }}>
            Explore our programmes
          </h1>
          <p style={{
            fontSize: '15px', color: 'rgba(255,255,255,0.5)',
            maxWidth: '480px', margin: '0 auto', lineHeight: 1.7,
          }}>
            Your account is ready. Pick a programme below to see the full curriculum,
            then enrol when you&apos;re ready — your dashboard, notes, and live classes
            unlock immediately after payment.
          </p>
        </div>

        {/* Programme cards — the actual explore experience */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '16px', marginBottom: '40px',
        }} className="r-grid-2">
          {programmes.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
              No programmes are currently open for enrolment. Check back soon, or contact us directly.
            </div>
          )}
          {programmes.map((p, i) => {
            const palette = PALETTE[i % PALETTE.length]
            const priceLabel = p.price_inr ? `₹${p.price_inr.toLocaleString('en-IN')}` : 'Contact us'

            return (
              <Link key={p.id} href={`/programs/${p.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  background: `rgba(${palette.rgb},0.05)`,
                  border: `1px solid rgba(${palette.rgb},0.2)`,
                  borderRadius: '18px', padding: '26px', height: '100%',
                  position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                    background: `linear-gradient(90deg, ${palette.color}, transparent)`,
                  }}/>

                  {p.tagline && (
                    <div style={{ fontSize: '11px', color: palette.color, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                      {p.tagline}
                    </div>
                  )}
                  <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '20px',
                    color: '#fff', marginBottom: '10px' }}>
                    {p.name}
                  </div>
                  {p.description && (
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '14px' }}>
                      {p.description}
                    </p>
                  )}

                  {/* Instructor */}
                  {p.instructor_name && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px',
                      padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
                    }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                        background: `rgba(${palette.rgb},0.2)`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: palette.color,
                      }}>
                        {p.instructor_name.charAt(0)}
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: 1.3 }}>
                        <div style={{ color: '#fff', fontWeight: 600 }}>{p.instructor_name}</div>
                        {p.instructor_title && (
                          <div style={{ color: 'rgba(255,255,255,0.4)' }}>{p.instructor_title}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Learning outcomes — top 3 shown on the card */}
                  {p.learning_outcomes && p.learning_outcomes.length > 0 && (
                    <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none' }}>
                      {p.learning_outcomes.slice(0, 3).map((o, oi) => (
                        <li key={oi} style={{
                          fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5,
                          marginBottom: '4px', paddingLeft: '16px', position: 'relative',
                        }}>
                          <span style={{ position: 'absolute', left: 0, color: palette.color }}>✓</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
                    {[
                      p.duration_label,
                      p.difficulty ? DIFFICULTY_LABEL[p.difficulty] : null,
                      priceLabel,
                    ].filter(Boolean).map(t => (
                      <span key={t} style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                        background: `rgba(${palette.rgb},0.1)`, color: palette.color,
                      }}>{t}</span>
                    ))}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontSize: '13px', fontWeight: 700, color: palette.color,
                  }}>
                    View curriculum →
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Soft enrol CTA — secondary to the explore cards above */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>
              Ready to enrol?
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
              {hasPendingRequest
                ? 'Your payment is already being reviewed — no action needed.'
                : 'Pick a plan and get instant access after payment.'}
            </div>
          </div>
          {!hasPendingRequest && (
            <Link href="/payment" style={{
              flexShrink: 0, padding: '12px 26px', borderRadius: '100px',
              background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
              color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 700,
              fontSize: '14px', textDecoration: 'none',
              boxShadow: '0 6px 24px rgba(59,91,219,0.35)',
            }}>
              Enrol Now →
            </Link>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
          Questions?{' '}
          <a href="mailto:contact@tivra.in" style={{ color: 'rgba(0,212,255,0.5)', textDecoration: 'none' }}>
            contact@tivra.in
          </a>
        </p>
      </div>
    </div>
  )
}
