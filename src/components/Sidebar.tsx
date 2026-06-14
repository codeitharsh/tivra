'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, ClipboardList, Award,
  Trophy, MessageCircle, CalendarCheck, Video, LogOut,
  Upload, Settings2, ShieldCheck, UserCheck,
  BarChart3, Users, Home, TrendingUp, Layers, BookMarked,
  Target, Menu, X, ChevronRight,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import type { Profile, UserRole } from '@/types/database'

interface SidebarProps { profile: Profile | null }

const NAV_STUDENT = [
  { href:'/dashboard',                             label:'Dashboard',    icon:LayoutDashboard },
  { href:'/programs/cloud-launchpad/content',      label:'Study Content',icon:BookOpen },
  { href:'/programs/cloud-launchpad/tests',        label:'Weekly Tests', icon:ClipboardList },
  { href:'/programs/cloud-launchpad/assessments',  label:'Assessments',  icon:Target },
  { href:'/programs/cloud-launchpad/certificate',  label:'Certificate',  icon:Award },
]
const NAV_COMMUNITY = [
  { href:'/leaderboard', label:'Leaderboard',   icon:Trophy },
  { href:'/doubts',      label:'Doubt Corner',  icon:MessageCircle },
  { href:'/attendance',  label:'My Attendance', icon:CalendarCheck },
  { href:'/live',        label:'Live Classes',  icon:Video },
]
const NAV_TEACHER = [
  { href:'/teacher',              label:'Teacher Home',   icon:Home },
  { href:'/teacher/curriculum',   label:'Curriculum',     icon:BookMarked },
  { href:'/teacher/content',      label:'Upload Notes',   icon:Upload },
  { href:'/teacher/tests',        label:'Create Tests',   icon:ClipboardList },
  { href:'/teacher/assessments',  label:'Assessments',    icon:Target },
  { href:'/teacher/doubts',       label:'Resolve Doubts', icon:MessageCircle },
  { href:'/teacher/live',         label:'Schedule Class', icon:Video },
  { href:'/teacher/attendance',   label:'Attendance',     icon:CalendarCheck },
]
const NAV_ADMIN = [
  { href:'/admin',              label:'Overview',      icon:BarChart3 },
  { href:'/admin/analytics',    label:'Analytics',     icon:TrendingUp },
  { href:'/admin/batches',      label:'Batches',       icon:Layers },
  { href:'/admin/students',     label:'All Users',     icon:Users },
  { href:'/admin/access',       label:'Grant Access',  icon:UserCheck },
  { href:'/admin/payments',     label:'Payments',      icon:ShieldCheck },
  { href:'/admin/assessments',  label:'Assessments',   icon:Target },
  { href:'/admin/content',      label:'Content',       icon:Upload },
  { href:'/admin/tests',        label:'Tests',         icon:ClipboardList },
  { href:'/admin/live',         label:'Live Sessions', icon:Video },
  { href:'/admin/attendance',   label:'Attendance',    icon:CalendarCheck },
  { href:'/admin/settings',     label:'Settings',      icon:Settings2 },
]

function getRoleMeta(role: UserRole | undefined) {
  switch (role) {
    case 'admin':   return { label: 'Admin',   grad: true }
    case 'teacher': return { label: 'Teacher', color: '#a78bfa', bg: 'rgba(124,58,237,0.15)' }
    case 'parent':  return { label: 'Parent',  color: '#93c5fd', bg: 'rgba(59,91,219,0.15)' }
    default:        return { label: 'Student', color: '#00d4ff', bg: 'rgba(0,212,255,0.1)' }
  }
}

function getInitials(n: string | null) {
  if (!n) return '?'
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function NavSection({
  label, items, isActive,
}: {
  label?: string
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number }> }[]
  isActive: (href: string) => boolean
}) {
  return (
    <div style={{ marginBottom: '6px' }}>
      {label && (
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.12em', textTransform: 'uppercase', padding: '10px 16px 4px' }}>
          {label}
        </div>
      )}
      {items.map(({ href, label: lbl, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 16px', borderRadius: '8px', margin: '1px 8px',
              background: active ? 'rgba(59,91,219,0.18)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
              fontFamily: 'DM Sans,sans-serif', fontSize: '13px', fontWeight: active ? 600 : 400,
              transition: 'all 0.15s',
              borderLeft: active ? '2px solid var(--cyan)' : '2px solid transparent',
            }}>
              <Icon size={15}/>
              <span style={{ flex: 1 }}>{lbl}</span>
              {active && <ChevronRight size={12} style={{ opacity: 0.4 }}/>}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname    = usePathname()
  const [busy, setBusy]       = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const role = profile?.role ?? 'student'
  const rm   = getRoleMeta(role)

  // Close mobile menu on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const isActive = (href: string) =>
    ['/dashboard', '/admin', '/teacher'].includes(href)
      ? pathname === href
      : pathname.startsWith(href)

  async function handleLogout() { setBusy(true); await logout() }

  // ── Sidebar content (shared between desktop and mobile) ──
  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/tivra-logo.jpeg" alt="Tivra" width={32} height={32}
            style={{ borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}/>
          <div>
            <div style={{
              fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '16px',
              letterSpacing: '0.08em',
              background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>TIVRA</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: '-1px' }}>
              Rise Beyond
            </div>
          </div>
        </Link>
      </div>

      {/* Profile pill */}
      <Link href="/profile" style={{ textDecoration: 'none', display: 'block', margin: '10px 8px 6px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 10px',
          borderRadius: '10px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)', transition: 'background 0.15s',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#00c8f8,#7030d0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '11px', color: '#fff',
          }}>
            {getInitials(profile?.full_name ?? null)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name ?? 'User'}
            </div>
            <div style={{
              display: 'inline-block', fontSize: '9px', fontWeight: 700, padding: '1px 6px',
              borderRadius: '10px', marginTop: '2px',
              background: rm.grad
                ? 'linear-gradient(135deg,#00c8f8,#7030d0)'
                : (rm as { bg: string }).bg,
              color: rm.grad ? '#fff' : (rm as { color: string }).color,
            }}>
              {rm.label}
            </div>
          </div>
        </div>
      </Link>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', overflowX: 'hidden' }}>
        {role === 'student' && (
          <>
            <NavSection items={NAV_STUDENT} isActive={isActive}/>
            <NavSection label="Community" items={NAV_COMMUNITY} isActive={isActive}/>
          </>
        )}
        {role === 'teacher' && (
          <NavSection items={NAV_TEACHER} isActive={isActive}/>
        )}
        {role === 'admin' && (
          <NavSection items={NAV_ADMIN} isActive={isActive}/>
        )}
        {role === 'parent' && (
          <NavSection items={NAV_STUDENT.filter(n => n.href !== '/programs/cloud-launchpad/certificate')} isActive={isActive}/>
        )}
      </div>

      {/* Logout */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
        <button onClick={handleLogout} disabled={busy} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px 16px', borderRadius: '8px', background: 'none',
          border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
          color: 'var(--red)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif',
          fontWeight: 500, transition: 'background 0.15s',
        }}>
          <LogOut size={14}/>
          {busy ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside style={{
        width: '220px', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}
        className="sidebar-desktop"
      >
        <SidebarContent/>
      </aside>

      {/* ── Mobile hamburger button ──────────────────────── */}
      <button
        onClick={() => setMobileOpen(v => !v)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        style={{
          display: 'none',
          position: 'fixed', top: '12px', left: '12px', zIndex: 200,
          width: '42px', height: '42px', borderRadius: '10px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text)',
        }}
        className="sidebar-mobile-btn"
      >
        {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
      </button>

      {/* ── Mobile overlay ───────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 150, backdropFilter: 'blur(4px)',
            display: 'none',
          }}
          className="sidebar-overlay"
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────── */}
      <aside
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: '260px',
          zIndex: 160, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
          // Only shown via CSS on mobile
        }}
        className="sidebar-mobile"
      >
        <SidebarContent/>
      </aside>

      {/* ── Responsive CSS ───────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile-btn { display: flex !important; }
          .sidebar-overlay { display: block !important; }
        }
        @media (min-width: 769px) {
          .sidebar-mobile { display: none !important; }
          .sidebar-mobile-btn { display: none !important; }
        }
      `}</style>
    </>
  )
}
