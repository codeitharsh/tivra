'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'

const LINKS = [
  { href: '/programs',   label: 'Programmes' },
  { href: '/free-notes', label: 'Handwritten Notes' },
  { href: '/courses',    label: 'Courses' },
  { href: '/about',      label: 'About' },
  { href: '/contact',    label: 'Contact' },
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
    <>
    <motion.nav
      ref={navRef}
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px', height: '64px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <Image src="/brand/tivra-wordmark-full-dark.png" alt="Tivra Learning" width={92} height={38} style={{ flexShrink: 0, height: '36px', width: 'auto' }}/>
      </Link>

      {/* Desktop links */}
      <div className="nav-links" style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} className="nav-top-link">{l.label}</Link>
        ))}
        <Link href="/login" className="btn btn-ghost" style={{ marginLeft: '12px' }}>Login</Link>
        {ENROLLMENT_OPEN ? (
          <Link href="/register" className="btn btn-primary">Enrol Now</Link>
        ) : (
          <span className="btn" style={{
            background: 'var(--card2)', color: 'var(--muted2)', cursor: 'not-allowed',
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

      <style>{`
        @media (max-width: 860px) {
          .nav-links { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
      `}</style>
    </motion.nav>

    {/* Mobile panel — deliberately rendered OUTSIDE <nav>, not nested
        inside it. Nav has backdropFilter set for its frosted-glass look,
        and in real (non-headless) rendering, filter/backdrop-filter on an
        ancestor makes it a containing block for position:fixed
        descendants — so this panel's top/bottom were being resolved
        against nav's own ~75px-tall box instead of the viewport,
        collapsing it to zero visible height while its children still
        measured "correctly" in isolation. Keeping it as a sibling avoids
        that containing-block entirely. */}
    <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
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
      </motion.div>
    )}
    </AnimatePresence>
    </>
  )
}
