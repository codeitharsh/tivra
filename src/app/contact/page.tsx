import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/PublicNav'

export const metadata: Metadata = {
  title: 'Contact Tivra',
  description: 'Get in touch with the Tivra team. We reply to every message.',
}

export default function ContactPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '72px 40px 80px' }}>

        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '11px', color: 'var(--cyan)', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontFamily: 'Space Mono,monospace', marginBottom: '14px' }}>
            Contact Us
          </div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: 'clamp(28px,5vw,48px)', color: '#fff',
            letterSpacing: '-0.03em', marginBottom: '14px' }}>
            We read every message
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--muted)', lineHeight: 1.7 }}>
            Whether you have a question about the programme, payment, access, or anything else —
            reach out and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

        <div style={{ display:'grid', marginBottom: '40px' }}>
          {[
            {
              icon: '📧', title: 'General Enquiries',
              desc: 'Questions about the programme, curriculum, or enrolment.',
              value: 'contact@tivra.in', href: 'mailto:contact@tivra.in',
            },
            {
              icon: '🎓', title: 'Academic Support',
              desc: 'Issues with your account, content, or certificates.',
              value: 'contact@tivra.in', href: 'mailto:contact@tivra.in',
            },
            {
              icon: '💳', title: 'Payment & Billing',
              desc: 'Payment confirmation or billing queries.',
              value: 'contact@tivra.in', href: 'mailto:contact@tivra.in',
            },
            {
              icon: '🏢', title: 'Institutional / Group',
              desc: 'Setting up a batch for your college or company.',
              value: 'contact@tivra.in', href: 'mailto:contact@tivra.in',
            },
          ].map(item => (
            <div key={item.title} style={{
              padding: '22px', borderRadius: 'var(--radius)',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>{item.icon}</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px',
                color: '#fff', marginBottom: '6px' }}>{item.title}</div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px',
                lineHeight: 1.6 }}>{item.desc}</p>
              <a href={item.href} style={{ fontSize: '13px', color: 'var(--cyan)',
                textDecoration: 'none', fontWeight: 500 }}>
                {item.value}
              </a>
            </div>
          ))}
        </div>

        <div style={{
          padding: '24px', borderRadius: 'var(--radius)',
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '16px',
            color: '#fff', marginBottom: '10px' }}>
            Response Times
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              ['General enquiries', 'Within 24 hours (working days)'],
              ['Payment verification', 'Within 24 hours after payment submission'],
              ['Technical support', 'Within 12 hours'],
              ['Refund requests', 'Within 3–5 working days'],
            ].map(([q, a]) => (
              <div key={q} style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: '13px', padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: 'var(--muted)' }}>{q}</span>
                <span style={{ color: '#fff', fontWeight: 500 }}>{a}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <Link href="/register" className="btn btn-primary"
            style={{ fontSize: '14px', padding: '12px 28px' }}>
            Enrol Now →
          </Link>
        </div>
      </div>
    </div>
  )
}
