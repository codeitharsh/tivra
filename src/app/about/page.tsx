import type { Metadata } from 'next'
import Link from 'next/link'
import { Rocket, GraduationCap, Users, ClipboardList } from 'lucide-react'
import PublicNav from '@/components/PublicNav'

export const metadata: Metadata = {
  title: 'About Tivra',
  description: 'Learn about Tivra — who we are, our mission, and why we built a better career tech training platform for Indian students.',
}

const BELIEFS = [
  { icon: Rocket,         title: 'Certification accelerates careers', desc: 'Employers shortlist candidates with verified credentials. Our programmes give you the knowledge AND the certificate to prove it.' },
  { icon: GraduationCap,  title: 'Certification matters — but skills matter more', desc: 'We design our curriculum so that passing the exam is a byproduct of actually understanding the technology.' },
  { icon: Users,          title: 'Cohort learning works', desc: 'Studying alongside peers who are at the same stage as you — with a real teacher who answers your questions — beats solo learning every time.' },
  { icon: ClipboardList,  title: 'Accountability creates results', desc: 'Weekly tests, attendance tracking, and a structured schedule keep students engaged where self-paced courses fail.' },
]

export default function AboutPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(56px,8vw,80px) clamp(20px,4vw,40px) 80px' }}>

        {/* Hero */}
        <div style={{ marginBottom: '56px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontFamily: 'var(--font-mono), monospace', marginBottom: '16px' }}>
            Our Story
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600,
            fontSize: 'clamp(2rem,5vw,3.4rem)', color: 'var(--text)',
            letterSpacing: '-0.02em', lineHeight: 1.06, marginBottom: '20px' }}>
            Learn skills.<br/>
            <span style={{ color: 'var(--accent)' }}>Earn certificates.</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '580px' }}>
            Tivra is a career-focused tech training platform designed for Indian engineering students
            and freshers who want real, job-ready skills — not just certificates.
          </p>
        </div>

        {/* Mission */}
        <div className="tv-clip" style={{ marginBottom: '48px', padding: '28px', borderRadius: 'var(--radius)',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderLeft: '2px solid var(--accent)' }}>
          <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '18px',
            color: 'var(--text)', marginBottom: '10px' }}>Our Mission</div>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7 }}>
            To give every engineering student in India a clear, structured, and affordable path
            to professional certification — with the live instruction, accountability, and community
            that self-paced courses can&apos;t provide.
          </p>
        </div>

        {/* What we believe */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '22px',
            color: 'var(--text)', marginBottom: '20px' }}>What we believe</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {BELIEFS.map((b, i) => (
              <div key={b.title} style={{
                display: 'flex', gap: '16px', padding: '20px 4px',
                borderTop: i === 0 ? '1px solid var(--border)' : 'none',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{
                  width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  background: 'var(--card2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
                }}><b.icon size={17}/></span>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '15px',
                    color: 'var(--text)', marginBottom: '4px' }}>{b.title}</div>
                  <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.65 }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The programmes */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '22px',
            color: 'var(--text)', marginBottom: '12px' }}>Our Programmes</h2>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '16px' }}>
            We run structured, instructor-led programmes across cloud computing, full-stack development,
            DevOps, and more — each designed to take you from zero to certified, job-ready.
          </p>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7 }}>
            Every session is live. Every note is uploaded. Every doubt gets answered.
            Every assessment is verified with a certificate you can share.
          </p>
        </div>

        {/* Contact CTA */}
        <div className="tv-clip" style={{ padding: '28px', borderRadius: 'var(--radius)',
          background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '18px',
            color: 'var(--text)', marginBottom: '8px' }}>
            Have questions?
          </div>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '18px' }}>
            We&apos;re a small team and we read every message personally.
          </p>
          <Link href="/contact" className="btn btn-primary">Get in Touch</Link>
        </div>
      </div>
    </div>
  )
}
