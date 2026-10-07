import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

interface AuthShellProps {
  profile: Profile | null
  title: string
  subtitle?: string
  /** Default 1100 — resolves a drift where most pages copied 1100px but
   * a handful (e.g. the students table) copied 1080px. 1100 is both the
   * majority value and strictly safe/wider for table pages. */
  maxWidth?: number | string
  /** Escape hatch for a page that needs a full-bleed main area (its own
   * inner scroll region, a canvas, etc.) — renders children raw with no
   * wrapping padded container. */
  noContainer?: boolean
  children: React.ReactNode
}

// The shared Sidebar+Topbar+content shell every authenticated page needs —
// previously hand-copied near-verbatim across ~56 files, with maxWidth
// silently drifting between 1080px and 1100px depending which file it was
// copy-pasted from. This is the single source of truth going forward.
export default function AuthShell({
  profile, title, subtitle, maxWidth = 1100, noContainer, children,
}: AuthShellProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title={title} subtitle={subtitle}/>
        {noContainer ? children : (
          <div style={{ padding: '28px', maxWidth, margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        )}
      </main>
    </div>
  )
}
