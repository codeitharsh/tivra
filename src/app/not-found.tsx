import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '440px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px',
          textDecoration: 'none', marginBottom: '40px', justifyContent: 'center' }}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32}/>
          <span style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '19px', color: 'var(--text)' }}>Tivra</span>
        </Link>

        <div className="tick-rule tick-rule-accent" style={{ marginBottom: '20px' }}/>

        <div style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: 'clamp(70px,14vw,120px)',
          lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '12px', color: 'var(--card2)',
          WebkitTextStroke: '1px var(--border2)' }}>
          404
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: 'clamp(20px,4vw,28px)',
          color: 'var(--text)', marginBottom: '12px', letterSpacing: '-0.01em' }}>
          Page not found
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '32px',
          maxWidth: '360px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn-primary">Go Home</Link>
          <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </div>
    </div>
  )
}
