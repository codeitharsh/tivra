import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/PublicNav'

export const metadata: Metadata = {
  title: 'Refund Policy | Tivra',
  description: 'Tivra refund and cancellation policy for Cloud LaunchPad programme enrolments.',
}

export default function RefundPage() {
  const sections = [
    {
      title: '1. Overview',
      content: 'Tivra EdTech ("Tivra", "we", "us") offers a fair refund policy for all programme enrolments. Please read this policy carefully before enrolling. By completing payment, you agree to this refund policy.',
    },
    {
      title: '2. Refund Eligibility Window',
      content: 'You may request a full refund within 7 days of your account being activated by our team, provided you have not completed more than 2 modules of content, taken more than 1 weekly test, or downloaded any study notes or materials. Refund requests made after 7 days of activation, or after significant engagement with the content, will not be eligible for a full refund.',
    },
    {
      title: '3. Partial Refunds',
      content: 'A partial refund of 50% may be considered on a case-by-case basis between 7 and 14 days of account activation, at the sole discretion of Tivra, if valid reasons are provided and engagement with the platform has been minimal. Partial refunds are not available after 14 days.',
    },
    {
      title: '4. Non-Refundable Situations',
      content: 'No refund will be issued in the following situations: (a) the request is made more than 14 days after account activation; (b) you have completed 3 or more modules; (c) you have taken 2 or more weekly tests; (d) your account was suspended or restricted due to violation of our Terms of Service; (e) you have passed a phase assessment and a certificate has been issued.',
    },
    {
      title: '5. How to Request a Refund',
      content: 'To request a refund, email billing@tivra.in with the subject line "Refund Request — [Your Full Name]". Include your registered email address, the reason for your request, and your payment transaction reference number. We will respond within 3–5 working days.',
    },
    {
      title: '6. Refund Processing',
      content: 'Approved refunds will be processed to the original payment method within 7–10 working days after approval. UPI refunds are typically faster (2–3 working days). Bank transfer refunds may take up to 10 working days depending on your bank.',
    },
    {
      title: '7. Programme Cancellation by Tivra',
      content: 'In the unlikely event that Tivra cancels a programme batch before it begins, all students enrolled in that batch will receive a full refund within 10 working days, or the option to transfer to the next available batch at no additional cost.',
    },
    {
      title: '8. Batch Transfer',
      content: 'If you are unable to continue with your current batch due to genuine circumstances (medical, academic, or personal emergencies), you may request a transfer to the next batch within 30 days of your activation date. Batch transfers are subject to availability and are offered once per enrolment.',
    },
    {
      title: '9. Grievance Redressal',
      content: 'If you are unsatisfied with our refund decision, you may escalate the matter to our Grievance Officer by emailing contact@tivra.in with the subject "Grievance — Refund". We will review and respond within 7 working days.',
    },
    {
      title: '10. Contact',
      content: 'For refund requests and billing queries: billing@tivra.in | For grievances: contact@tivra.in',
    },
  ]

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '72px 40px 80px' }}>

        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: 'clamp(28px,5vw,44px)', color: '#fff',
            letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Refund Policy
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
            Last updated: January 2025 · Effective for all enrolments from January 2025
          </p>
        </div>

        {/* Key points summary */}
        <div style={{
          padding: '20px 24px', borderRadius: 'var(--radius)', marginBottom: '40px',
          background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)',
        }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px',
            color: 'var(--cyan)', marginBottom: '12px', letterSpacing: '0.06em',
            textTransform: 'uppercase' }}>
            Summary
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              ['✓', 'Full refund within 7 days of activation (minimal usage)', 'var(--green)'],
              ['◑', 'Partial refund (50%) between 7–14 days, case by case', 'var(--amber)'],
              ['✗', 'No refund after 14 days or after passing an assessment', 'var(--red)'],
              ['↔', 'Batch transfer available within 30 days for emergencies', 'var(--cyan)'],
            ].map(([icon, text, color]) => (
              <div key={text as string} style={{ display: 'flex', gap: '10px',
                fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: color as string, flexShrink: 0, fontWeight: 700 }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {sections.map(s => (
            <div key={s.title}>
              <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '16px',
                color: '#fff', marginBottom: '8px' }}>{s.title}</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                {s.content}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', paddingTop: '24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Link href="/terms" style={{ color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none' }}>
            Terms of Service
          </Link>
          <Link href="/privacy" style={{ color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none' }}>
            Privacy Policy
          </Link>
          <Link href="/contact" style={{ color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none' }}>
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  )
}
