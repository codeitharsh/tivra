'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'

const LINKS = [
  { href: '/programs', label: 'Programmes' },
  { href: '/about',    label: 'About' },
  { href: '/contact',  label: 'Contact' },
]

export default function PublicNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  // Measured, not hardcoded — a fixed '65px' guess previously drifted out
  // of sync with the nav's real rendered height (measured ~75px), leaving
  // a ~10px gap where the dropdown panel's top edge sat behind the nav
  // bar instead of flush against it.
  const [navHeight, setNavHeight] = useState(65)

  useEffect(() => {
    function measure() {
      if (navRef.current) setNavHeight(navRef.current.offsetHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <nav ref={navRef} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 40px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(11,11,13,0.88)', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={30} height={30} style={{ flexShrink: 0 }}/>
        <span style={{
          fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '19px',
          color: 'var(--text)', letterSpacing: '-0.01em',
        }}>Tivra</span>
      </Link>

      {/* Desktop links */}
      <div className="nav-links" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} style={{
            fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-sans), sans-serif',
            textDecoration: 'none', padding: '8px 14px', borderRadius: 'var(--radius-sm)',
            transition: 'color 0.15s',
          }}>{l.label}</Link>
        ))}
        <Link href="/login" className="btn btn-ghost" style={{ marginLeft: '8px' }}>Login</Link>
        {ENROLLMENT_OPEN ? (
          <Link href="/register" className="btn btn-primary">Enrol Now</Link>
        ) : (
          <span className="btn" style={{
            background: 'var(--card2)', color: 'var(--muted2)', cursor: 'not-allowed',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Revealing Soon</span>
        )}
      </div>

      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="nav-mobile-btn"
        style={{
          display: 'none', width: '38px', height: '38px', borderRadius: 'var(--radius-sm)',
          background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {open ? <X size={18}/> : <Menu size={18}/>}
      </button>

      {/* Mobile panel */}
      {open && (
        <div style={{
          position: 'fixed', top: `${navHeight}px`, left: 0, right: 0, bottom: 0, zIndex: 99,
          background: 'var(--bg)', borderTop: '1px solid var(--border)',
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '4px',
          overflowY: 'auto',
        }}>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{
              fontSize: '17px', color: 'var(--text)', fontFamily: 'var(--font-sans), sans-serif',
              textDecoration: 'none', padding: '14px 4px', borderBottom: '1px solid var(--border)',
            }}>{l.label}</Link>
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <Link href="/login" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Login</Link>
            {ENROLLMENT_OPEN ? (
              <Link href="/register" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Enrol Now</Link>
            ) : (
              <span className="btn" style={{
                flex: 1, justifyContent: 'center', background: 'var(--card2)', color: 'var(--muted2)',
              }}>Soon</span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .nav-links { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  )
}
