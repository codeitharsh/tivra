import Link from 'next/link'
import Image from 'next/image'

export default function TermsPage() {
  const sections = [
    ['1. Acceptance of Terms', 'By registering on Tivra you agree to these Terms of Service. If you disagree with any part, you may not access the platform.'],
    ['2. Eligibility', 'You must be at least 15 years of age to register. You must register with accurate personal information and agree to abide by the platform rules.'],
    ['3. Account Responsibilities', 'You are responsible for maintaining the confidentiality of your login credentials. You may not share your account with others. Each person must have their own account.'],
    ['4. Programme Enrolment', 'Access is granted only after payment verification by our team. We reserve the right to reject or revoke access at our discretion.'],
    ['5. Content Usage', 'All study notes, videos, assessments, and materials are for your personal learning only. You may not distribute, resell, or share platform content without written permission.'],
    ['6. Certificates', 'Certificates are issued automatically upon passing phase assessments with a score of 75% or above. Tivra reserves the right to revoke certificates if fraudulent activity is detected.'],
    ['7. Refund Policy', 'Refunds are considered on a case-by-case basis within 7 days of payment. Contact us at support@tivra.in with your payment reference.'],
    ['8. Conduct', 'You agree not to misuse the platform, harass other users or staff, attempt to circumvent security measures, or use automated tools to access the platform.'],
    ['9. Modifications', 'We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.'],
    ['10. Contact', 'For questions about these terms, contact us at legal@tivra.in.'],
  ]

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <nav style={{
        padding: '20px 40px', display: 'flex', alignItems: 'center', gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo.png" alt="Tivra" width={32} height={32} style={{ borderRadius: '8px', objectFit: 'cover' }}/>
          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '16px',
            background: 'linear-gradient(135deg,#00c8f8,#7030d0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.08em' }}>TIVRA</span>
        </Link>
      </nav>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 40px' }}>
        <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '36px',
          marginBottom: '8px', color: '#fff', letterSpacing: '-0.02em' }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '40px' }}>
          Last updated: January 2026
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {sections.map(([title, content]) => (
            <div key={title}>
              <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '16px',
                color: '#fff', marginBottom: '8px' }}>{title}</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>{content}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <Link href="/register" style={{ color: 'var(--cyan)', fontSize: '14px', textDecoration: 'none' }}>
            ← Back to Register
          </Link>
        </div>
      </div>
    </div>
  )
}
