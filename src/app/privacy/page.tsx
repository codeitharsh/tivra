import Link from 'next/link'
import Image from 'next/image'

export default function PrivacyPage() {
  const sections = [
    ['1. Information We Collect', 'We collect your name, email address, phone number, and usage data (test scores, module progress, attendance, login history) when you register and use Tivra.'],
    ['2. How We Use Your Data', 'Your data is used to manage your account, track learning progress, issue certificates, and communicate important platform updates. We do not sell your data.'],
    ['3. Data Sharing', 'We share your progress data with teachers assigned to your programme. We do not share your data with unrelated third parties.'],
    ['4. Certificates & Verification', 'Certificate records including your name and score are stored permanently and accessible via the public verification URL. This is required for certificate authenticity.'],
    ['5. Cookies', 'We use essential cookies for authentication. No advertising or tracking cookies are used.'],
    ['6. Data Security', 'Your data is stored on Supabase infrastructure with row-level security. Passwords are hashed and never stored in plain text.'],
    ['7. Your Rights', 'You may request deletion of your account and associated data by contacting contact@tivra.in. Note that certificate records may be retained for verification purposes.'],
    ['8. Children\'s Privacy', 'Tivra is intended for users aged 15 and above. We do not knowingly collect data from children under 15.'],
    ['9. Changes', 'We may update this policy. Significant changes will be communicated via email or a platform notification.'],
    ['10. Contact', 'Privacy questions or requests: contact@tivra.in'],
  ]

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <nav style={{
        padding: '20px 40px', display: 'flex', alignItems: 'center', gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32} />
          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '16px',
            background: 'linear-gradient(135deg,#00c8f8,#7030d0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.08em' }}>TIVRA</span>
        </Link>
      </nav>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 40px' }}>
        <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '36px',
          marginBottom: '8px', color: '#fff', letterSpacing: '-0.02em' }}>
          Privacy Policy
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
