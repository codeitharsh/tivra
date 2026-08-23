export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import SignOutButton from './SignOutButton'
import WhatsAppBanner from '@/components/WhatsAppBanner'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'
import { PROGRAM_META, DEFAULT_PROGRAM_META } from '@/lib/program-meta'
import { Clock, XCircle, ArrowRight, Check, Library } from 'lucide-react'

import type { Profile, Program } from '@/types/database'

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32} />
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '15px',
              letterSpacing: '0.08em', color: 'var(--text)' }}>TIVRA</div>
            <div style={{ fontSize: '8px', color: 'var(--muted2)',
              letterSpacing: '0.14em', textTransform: 'uppercase' }}>Rise Beyond</div>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {profile.full_name ?? profile.email}
          </span>
          <SignOutButton/>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Payment status banner — only shown if relevant, otherwise this
            whole section collapses so the explore content is front and center */}
        {(hasPendingRequest || isRejected) && (
          <div className={`banner ${hasPendingRequest ? 'banner-warning' : ''}`} style={{
            background: hasPendingRequest ? undefined : 'var(--red-dim)',
            border: hasPendingRequest ? undefined : '1px solid rgba(240,69,58,0.25)',
            padding: '18px 22px', marginBottom: '32px',
            justifyContent: 'space-between', flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              {hasPendingRequest ? <Clock size={18} style={{ flexShrink: 0, marginTop: '2px' }}/> : <XCircle size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: '2px' }}/>}
              <div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '14px',
                  color: hasPendingRequest ? 'var(--amber)' : 'var(--red)', marginBottom: '4px',
                }}>
                  {hasPendingRequest ? 'Payment under review' : 'Payment not verified'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {hasPendingRequest
                    ? "You'll receive access within 24 hours on working days."
                    : <>Couldn&apos;t verify your payment. <a href="mailto:contact@tivra.in" style={{ color: 'var(--accent-2)' }}>Contact us</a> or resubmit below.</>}
                </div>
              </div>
            </div>
            {isRejected && (
              ENROLLMENT_OPEN ? (
                <Link href="/payment" className="btn btn-primary" style={{ flexShrink: 0, fontSize: '13px' }}>
                  Resubmit payment <ArrowRight size={13}/>
                </Link>
              ) : (
                <span className="btn btn-ghost" style={{ flexShrink: 0, fontSize: '13px', cursor: 'not-allowed', opacity: 0.6 }}>
                  Enrollments will start soon
                </span>
              )
            )}
          </div>
        )}

        {/* Hero — explore framing, not a payment wall */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: 'var(--radius-pill)', marginBottom: '20px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent-ring)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-2)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              WELCOME TO TIVRA
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 600,
            fontSize: 'clamp(28px,5vw,40px)', color: 'var(--text)',
            letterSpacing: '-0.01em', marginBottom: '14px', lineHeight: 1.15,
          }}>
            Explore our programmes
          </h1>
          <p style={{
            fontSize: '15px', color: 'var(--muted)',
            maxWidth: '480px', margin: '0 auto', lineHeight: 1.7,
          }}>
            Your account is ready. Pick a programme below to see the full curriculum,
            then enrol when you&apos;re ready — your dashboard, notes, and live classes
            unlock immediately after payment.
          </p>
        </div>

        {/* Free Notes CTA — the highest-value thing to show a freshly
            registered, not-yet-paid visitor: something genuinely useful
            they can use right now, with zero payment required. Placed
            above the paid-programme grid deliberately. */}
        <Link href="/free-notes" style={{ textDecoration: 'none', display: 'block', marginBottom: '32px' }}>
          <div className="card" style={{
            padding: '22px 26px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
            border: '1px solid var(--accent-2-dim)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Library size={18}/>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                    Free Notes
                  </span>
                  <span className="pill" style={{ background: 'var(--accent-2-dim)', color: 'var(--accent-2)' }}>Free</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  DSA, Computer Networks, OOPS, DBMS and more — free for every registered user, no enrolment needed.
                </div>
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-2)', flexShrink: 0 }}>
              Browse notes <ArrowRight size={14}/>
            </span>
          </div>
        </Link>

        {/* Programme cards — the actual explore experience */}
        <div className="r-grid-2" style={{ marginBottom: '40px' }}>
          {programmes.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '13px' }}>
              No programmes are currently open for enrolment. Check back soon, or contact us directly.
            </div>
          )}
          {programmes.map(p => {
            const meta = PROGRAM_META[p.slug] ?? DEFAULT_PROGRAM_META
            const Icon = meta.icon
            const priceLabel = p.price_inr ? `₹${p.price_inr.toLocaleString('en-IN')}` : 'Revealing soon'

            return (
              <Link key={p.id} href={`/programs/${p.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                <div className="card" style={{
                  borderTop: `2px solid ${meta.color}`,
                  padding: '26px', height: '100%',
                }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '6px', flexShrink: 0,
                    background: `rgba(${meta.colorRgb},0.14)`, color: meta.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '12px',
                  }}>
                    <Icon size={16}/>
                  </div>

                  {p.tagline && (
                    <div style={{ fontSize: '11px', color: meta.color, fontWeight: 600,
                      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                      {p.tagline}
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px',
                    color: 'var(--text)', marginBottom: '10px' }}>
                    {p.name}
                  </div>
                  {p.description && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '14px' }}>
                      {p.description}
                    </p>
                  )}

                  {/* Instructor */}
                  {p.instructor_name && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px',
                      padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--card2)',
                    }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
                        background: `rgba(${meta.colorRgb},0.18)`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: meta.color,
                      }}>
                        {p.instructor_name.charAt(0)}
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: 1.3 }}>
                        <div style={{ color: 'var(--text)', fontWeight: 600 }}>{p.instructor_name}</div>
                        {p.instructor_title && (
                          <div style={{ color: 'var(--muted)' }}>{p.instructor_title}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Learning outcomes — top 3 shown on the card */}
                  {p.learning_outcomes && p.learning_outcomes.length > 0 && (
                    <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none' }}>
                      {p.learning_outcomes.slice(0, 3).map((o, oi) => (
                        <li key={oi} style={{
                          fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5,
                          marginBottom: '4px', paddingLeft: '18px', position: 'relative',
                        }}>
                          <Check size={12} style={{ position: 'absolute', left: 0, top: '3px', color: meta.color }}/>
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
                      <span key={t} className="pill" style={{
                        background: `rgba(${meta.colorRgb},0.12)`, color: meta.color,
                      }}>{t}</span>
                    ))}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontSize: '13px', fontWeight: 600, color: meta.color,
                  }}>
                    View curriculum <ArrowRight size={13}/>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Soft enrol CTA — secondary to the explore cards above */}
        <div className="card" style={{
          padding: '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
              Ready to enrol?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {hasPendingRequest
                ? 'Your payment is already being reviewed — no action needed.'
                : ENROLLMENT_OPEN
                  ? 'Pick a plan and get instant access after payment.'
                  : 'Enrollments will start soon. Check back for updates.'}
            </div>
          </div>
          {!hasPendingRequest && (
            ENROLLMENT_OPEN ? (
              <Link href="/payment" className="btn btn-primary" style={{ flexShrink: 0, fontSize: '14px' }}>
                Enrol now <ArrowRight size={14}/>
              </Link>
            ) : (
              <span className="btn btn-ghost" style={{ flexShrink: 0, fontSize: '14px', cursor: 'not-allowed', opacity: 0.6 }}>
                Enrollments will start soon
              </span>
            )
          )}
        </div>

        <WhatsAppBanner/>

        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: 'var(--muted2)' }}>
          Questions?{' '}
          <a href="mailto:contact@tivra.in" style={{ color: 'var(--accent-2)', textDecoration: 'none' }}>
            contact@tivra.in
          </a>
        </p>
      </div>
    </div>
  )
}
