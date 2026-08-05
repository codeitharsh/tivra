import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, GraduationCap, CreditCard, Building2 } from 'lucide-react'
import PublicNav from '@/components/PublicNav'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'

export const metadata: Metadata = {
  title: 'Contact Tivra',
  description: 'Get in touch with the Tivra team. We reply to every message.',
}

const CONTACTS = [
  { icon: Mail,          title: 'General Enquiries',       desc: 'Questions about the programme, curriculum, or enrolment.' },
  { icon: GraduationCap, title: 'Academic Support',        desc: 'Issues with your account, content, or certificates.' },
  { icon: CreditCard,    title: 'Payment & Billing',       desc: 'Payment confirmation or billing queries.' },
  { icon: Building2,     title: 'Institutional / Group',   desc: 'Setting up a batch for your college or company.' },
]

export default function ContactPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(56px,8vw,80px) clamp(20px,4vw,40px) 80px' }}>

        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontFamily: 'var(--font-mono), monospace', marginBottom: '16px' }}>
            Contact Us
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600,
            fontSize: 'clamp(1.9rem,5vw,3rem)', color: 'var(--text)',
            letterSpacing: '-0.02em', marginBottom: '14px' }}>
            We read every message
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--muted)', lineHeight: 1.7 }}>
            Whether you have a question about the programme, payment, access, or anything else —
            reach out and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

        <div className="tv-clip" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '40px' }}>
          {CONTACTS.map(item => (
            <div key={item.title} style={{ padding: '22px', background: 'var(--card)' }}>
              <span style={{
                width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: 'var(--card2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
                marginBottom: '12px',
              }}><item.icon size={16}/></span>
              <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '15px',
                color: 'var(--text)', marginBottom: '6px' }}>{item.title}</div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px',
                lineHeight: 1.6 }}>{item.desc}</p>
              <a href="mailto:contact@tivra.in" style={{ fontSize: '13px', color: 'var(--accent)',
                textDecoration: 'none', fontWeight: 600 }}>
                contact@tivra.in
              </a>
            </div>
          ))}
        </div>

        <div className="tv-clip" style={{
          padding: '24px', borderRadius: 'var(--radius)',
          background: 'var(--card)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '16px',
            color: 'var(--text)', marginBottom: '10px' }}>
            Response Times
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              ['General enquiries', 'Within 24 hours (working days)'],
              ['Payment verification', 'Within 24 hours after payment submission'],
              ['Technical support', 'Within 12 hours'],
              ['Refund requests', 'Within 3–5 working days'],
            ].map(([q, a]) => (
              <div key={q} style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: '13px', padding: '10px 0',
                borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>{q}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{a}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          {ENROLLMENT_OPEN ? (
            <Link href="/register" className="btn btn-primary">Enrol Now</Link>
          ) : (
            <span className="btn" style={{ background: 'var(--card2)', color: 'var(--muted2)', cursor: 'not-allowed' }}>
              Enrollments Will Start Soon
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
