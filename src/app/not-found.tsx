import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '300px',
        background: 'radial-gradient(ellipse,rgba(59,91,219,0.08) 0%,transparent 70%)',
        pointerEvents: 'none',
      }}/>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px',
          textDecoration: 'none', marginBottom: '40px', justifyContent: 'center' }}>
          <Image src="/tivra-logo.png" alt="Tivra" width={36} height={36}
            style={{ borderRadius: '9px', objectFit: 'cover' }}/>
          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '18px',
            background: 'linear-gradient(135deg,#00c8f8,#7030d0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.08em' }}>TIVRA</span>
        </Link>

        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 'clamp(80px,15vw,140px)',
          lineHeight: 1, letterSpacing: '-0.05em', marginBottom: '8px',
          background: 'linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          404
        </div>

        <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 'clamp(22px,4vw,32px)',
          color: '#fff', marginBottom: '12px', letterSpacing: '-0.02em' }}>
          Page not found
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--muted)', marginBottom: '32px',
          maxWidth: '360px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn-primary" style={{ fontSize: '14px', padding: '12px 28px' }}>
            Go Home
          </Link>
          <Link href="/dashboard" className="btn btn-ghost" style={{ fontSize: '14px' }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
