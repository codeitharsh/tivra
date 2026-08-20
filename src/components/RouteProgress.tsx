'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// ── Global navigation-feedback spinner ──────────────────────────
// The App Router has no built-in "navigation started/finished" event
// (unlike the old Pages Router's router.events), so a click on a
// <Link> gave zero visual feedback until the next page had fully
// rendered — on anything slower than instant it just reads as the
// site hanging.
//
// Tried patching history.pushState/replaceState first (the technique
// most nprogress-style libraries use) — confirmed via direct testing
// that it does NOT fire for real <Link> clicks in this Next.js
// version (only for a manually-called pushState), so Link's internal
// navigation isn't going through the property my patch replaces by
// the time it runs. A capture-phase click listener on the document is
// what actually reaches every real link click, independent of Next's
// internal implementation — kept the pushState/replaceState patch too
// as a secondary catch for programmatic router.push()/replace() calls
// that don't originate from a literal <a> click (e.g. a redirect after
// a form submits).
export default function RouteProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const hideRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function start() {
      if (hideRef.current) clearTimeout(hideRef.current)
      if (safetyRef.current) clearTimeout(safetyRef.current)
      setVisible(true)

      // Fallback: covers any start trigger that doesn't correspond to
      // an actual route change the pathname-effect below would catch
      // (e.g. a same-page link, or a click that gets cancelled) —
      // without this the spinner could get stuck visible forever.
      safetyRef.current = setTimeout(() => setVisible(false), 4000)
    }

    // Primary trigger: real clicks on internal links, caught at the
    // document level so it works no matter which component rendered
    // the <a> — sidebar nav, programme cards, footer, everywhere.
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return
      let url: URL
      try { url = new URL(href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }
    document.addEventListener('click', handleClick, true)

    // Secondary trigger: programmatic navigation (router.push/replace
    // after e.g. a form submit or an action succeeding).
    const originalPush    = window.history.pushState
    const originalReplace = window.history.replaceState
    window.history.pushState = function (...args) {
      start()
      return originalPush.apply(window.history, args)
    }
    window.history.replaceState = function (...args) {
      start()
      return originalReplace.apply(window.history, args)
    }

    return () => {
      document.removeEventListener('click', handleClick, true)
      window.history.pushState = originalPush
      window.history.replaceState = originalReplace
    }
  }, [])

  // The pathname actually changing is the real "navigation finished"
  // signal — the new route has committed and rendered.
  useEffect(() => {
    if (safetyRef.current) clearTimeout(safetyRef.current)
    // pathname changing IS the external signal this effect syncs to —
    // there's no user event to defer this to, same pattern used
    // elsewhere in this codebase for the same rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(false)
  }, [pathname])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.25s ease',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'route-progress-spin 0.7s linear infinite',
      }}/>
      <style>{`@keyframes route-progress-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
