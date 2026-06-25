import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/PublicNav'

export const metadata: Metadata = {
  title: 'About Tivra',
  description: 'Learn about Tivra — who we are, our mission, and why we built a better career tech training platform for Indian students.',
}

export default function AboutPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '72px 40px 80px' }}>

        {/* Hero */}
        <div style={{ marginBottom: '56px' }}>
          <div style={{ fontSize: '11px', color: 'var(--cyan)', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontFamily: 'Space Mono,monospace', marginBottom: '14px' }}>
            Our Story
          </div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800,
            fontSize: 'clamp(32px,5vw,52px)', color: '#fff',
            letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: '20px' }}>
            Learn skills.<br/>
            <span style={{ background: 'linear-gradient(135deg,#00d4ff,#7c3aed)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text' }}>
              Earn certificates.
            </span>
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '580px' }}>
            Tivra is a career-focused tech training platform designed for Indian engineering students
            and freshers who want real, job-ready skills — not just certificates.
          </p>
        </div>

        {/* Mission */}
        <div style={{ marginBottom: '48px', padding: '28px', borderRadius: 'var(--radius)',
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '3px solid var(--cyan)' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '18px',
            color: '#fff', marginBottom: '10px' }}>Our Mission</div>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7 }}>
            To give every engineering student in India a clear, structured, and affordable path
            to professional certification — with the live instruction, accountability, and community
            that self-paced courses can&apos;t provide.
          </p>
        </div>

        {/* What we believe */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '22px',
            color: '#fff', marginBottom: '20px' }}>What we believe</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              ['🚀', 'Certification accelerates careers', 'Employers shortlist candidates with verified credentials. Our programmes give you the knowledge AND the certificate to prove it.'],
              ['🎓', 'Certification matters — but skills matter more', 'We design our curriculum so that passing the exam is a byproduct of actually understanding the technology.'],
              ['👥', 'Cohort learning works', 'Studying alongside peers who are at the same stage as you — with a real teacher who answers your questions — beats solo learning every time.'],
              ['📋', 'Accountability creates results', 'Weekly tests, attendance tracking, and a structured schedule keep students engaged where self-paced courses fail.'],
            ].map(([icon, title, desc]) => (
              <div key={title as string} style={{ display: 'flex', gap: '16px', padding: '18px',
                borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '24px', flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px',
                    color: '#fff', marginBottom: '4px' }}>{title}</div>
                  <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.65 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The programmes */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '22px',
            color: '#fff', marginBottom: '12px' }}>Our Programmes</h2>
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
        <div style={{ padding: '28px', borderRadius: 'var(--radius)',
          background: 'linear-gradient(135deg,rgba(0,212,255,0.07),rgba(124,58,237,0.06))',
          border: '1px solid rgba(59,91,219,0.2)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '18px',
            color: '#fff', marginBottom: '8px' }}>
            Have questions?
          </div>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '18px' }}>
            We&apos;re a small team and we read every message personally.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: '13px', padding: '10px 24px' }}>
            Get in Touch →
          </Link>
        </div>
      </div>
    </div>
  )
}
