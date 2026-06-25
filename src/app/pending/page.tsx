export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'

import type { Profile } from '@/types/database'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile) redirect('/login')

  // If somehow active, redirect to dashboard
  if (profile.access_status === 'active') redirect('/dashboard')

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
    <div style={{
      minHeight: '100vh', background: '#07080c',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32}
            />
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
          <button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.href="/login"}} type="button" style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '6px 14px', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', fontSize: '12px',
            }}>
              Sign Out
            </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ maxWidth: '520px', width: '100%' }}>

          {/* Status card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${hasPendingRequest ? 'rgba(245,158,11,0.3)' : isRejected ? 'rgba(239,68,68,0.3)' : 'rgba(59,91,219,0.3)'}`,
            borderRadius: '20px', overflow: 'hidden',
          }}>
            {/* Top accent */}
            <div style={{
              height: '3px',
              background: hasPendingRequest
                ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                : isRejected
                ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                : 'linear-gradient(90deg,#00d4ff,#3b5bdb,#7c3aed)',
            }}/>

            <div style={{ padding: '40px 36px', textAlign: 'center' }}>
              {/* Icon */}
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>
                {hasPendingRequest ? '⏳' : isRejected ? '❌' : '🔐'}
              </div>

              {/* Heading */}
              <h1 style={{
                fontFamily: 'Syne,sans-serif', fontWeight: 800,
                fontSize: '24px', color: '#fff', marginBottom: '10px',
                letterSpacing: '-0.02em',
              }}>
                {hasPendingRequest
                  ? 'Payment Under Review'
                  : isRejected
                  ? 'Payment Not Verified'
                  : 'Complete Your Enrolment'}
              </h1>

              {/* Message */}
              <p style={{
                fontSize: '15px', color: 'rgba(255,255,255,0.5)',
                lineHeight: 1.7, marginBottom: '28px',
              }}>
                {hasPendingRequest ? (
                  <>
                    Your payment details have been submitted and are being reviewed by our team.
                    <br/>
                    <strong style={{ color: 'rgba(255,255,255,0.75)' }}>
                      You&apos;ll receive access within 24 hours
                    </strong>{' '}on working days.
                  </>
                ) : isRejected ? (
                  <>
                    We couldn&apos;t verify your payment. Please check the transaction reference
                    and resubmit, or contact us at{' '}
                    <a href="mailto:contact@tivra.in" style={{ color: '#00d4ff' }}>
                      contact@tivra.in
                    </a>.
                  </>
                ) : (
                  <>
                    Your account has been created. To access your course content,
                    complete the payment and submit your transaction reference.
                    Our team will activate your account within 24 hours.
                  </>
                )}
              </p>

              {/* Payment submitted info */}
              {hasPendingRequest && pr?.transaction_ref && (
                <div style={{
                  padding: '12px 16px', borderRadius: '10px', marginBottom: '24px',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  textAlign: 'left',
                }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Submitted Reference
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#f59e0b' }}>
                    {String(pr?.transaction_ref)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                    Submitted {new Date(pr?.created_at as string).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!hasPendingRequest && (
                  <Link href="/payment" style={{
                    display: 'block', padding: '14px 28px', borderRadius: '100px',
                    background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                    color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 700,
                    fontSize: '14px', letterSpacing: '0.04em', textDecoration: 'none',
                    textAlign: 'center',
                    boxShadow: '0 6px 24px rgba(59,91,219,0.4)',
                  }}>
                    Complete Payment →
                  </Link>
                )}

                {isRejected && (
                  <Link href="/payment" style={{
                    display: 'block', padding: '14px 28px', borderRadius: '100px',
                    background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                    color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 700,
                    fontSize: '14px', textDecoration: 'none', textAlign: 'center',
                  }}>
                    Resubmit Payment →
                  </Link>
                )}

                <a href="mailto:contact@tivra.in" style={{
                  display: 'block', padding: '12px', borderRadius: '100px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                  textDecoration: 'none', textAlign: 'center',
                }}>
                  Contact Support
                </a>
              </div>
            </div>
          </div>

          {/* What you get after activation */}
          <div style={{ marginTop: '24px', padding: '20px 24px',
            borderRadius: '14px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
              What you get after activation
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                ['📄', 'Study Notes'],
                ['🎥', 'Live Classes'],
                ['📋', 'Weekly Tests'],
                ['🏆', 'Certificates'],
                ['💬', 'Doubt Corner'],
                ['📊', 'Progress Tracking'],
              ].map(([icon, label]) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', color: 'rgba(255,255,255,0.45)',
                }}>
                  <span>{icon}</span>{label}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p style={{
            textAlign: 'center', marginTop: '20px',
            fontSize: '12px', color: 'rgba(255,255,255,0.2)',
          }}>
            Questions?{' '}
            <a href="mailto:contact@tivra.in" style={{ color: 'rgba(0,212,255,0.5)', textDecoration: 'none' }}>
              contact@tivra.in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
