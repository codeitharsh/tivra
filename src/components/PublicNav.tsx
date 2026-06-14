import Link from 'next/link'
import Image from 'next/image'

export default function PublicNav() {
  return (
    <nav style={{
      padding: '20px 40px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(8,8,12,0.95)', backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <Image src="/tivra-logo.png" alt="Tivra" width={32} height={32}
          style={{ borderRadius: '8px', objectFit: 'cover' }}/>
        <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '16px',
          background: 'linear-gradient(135deg,#00c8f8,#7030d0)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', letterSpacing: '0.08em' }}>
          TIVRA
        </span>
      </Link>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link href="/programs" style={{ fontSize: '13px', color: 'var(--muted)',
          textDecoration: 'none', padding: '7px 14px' }}>Programs</Link>
        <Link href="/about" style={{ fontSize: '13px', color: 'var(--muted)',
          textDecoration: 'none', padding: '7px 14px' }}>About</Link>
        <Link href="/contact" style={{ fontSize: '13px', color: 'var(--muted)',
          textDecoration: 'none', padding: '7px 14px' }}>Contact</Link>
        <Link href="/login" style={{ fontSize: '13px', color: 'var(--muted)',
          textDecoration: 'none', padding: '7px 16px', borderRadius: '100px',
          border: '1px solid rgba(255,255,255,0.1)' }}>Login</Link>
        <Link href="/register" style={{ fontSize: '13px', fontWeight: 700, color: '#fff',
          textDecoration: 'none', padding: '8px 20px', borderRadius: '100px',
          background: 'linear-gradient(135deg,#00c8f8,#3b5bdb,#7c3aed)' }}>Enrol</Link>
      </div>
    </nav>
  )
}
