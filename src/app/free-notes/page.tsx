export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import { Library, ArrowRight } from 'lucide-react'

interface SubjectRow {
  id: string; name: string; slug: string; description: string | null
}

export default async function FreeNotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  // Free Notes is intentionally accessible to ALL authenticated users
  // regardless of payment/enrollment status — that's the entire point
  // of this section (see migrations/2026-08-23-free-notes.sql). Login
  // is required (above) but NOT requireActiveStudent, matching the
  // exact precedent already established by /profile.

  const admin = createAdminClient()
  const { data: subjectsRaw } = await admin
    .from('subjects')
    .select('id, name, slug, description')
    .eq('is_active', true)
    .order('display_order')

  const { data: countsRaw } = await admin
    .from('free_notes')
    .select('subject_id')

  const noteCountBySubject: Record<string, number> = {}
  for (const n of (countsRaw ?? []) as { subject_id: string }[]) {
    noteCountBySubject[n.subject_id] = (noteCountBySubject[n.subject_id] ?? 0) + 1
  }

  const subjects = (subjectsRaw ?? []) as SubjectRow[]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Free Notes" subtitle="Self-study material for college exams and interview prep — open to everyone"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          <div className="banner banner-brand" style={{ marginBottom: '24px' }}>
            <Library size={16} style={{ flexShrink: 0 }}/>
            <div style={{ fontSize: '13px' }}>
              <strong style={{ color: 'var(--text)' }}>Free for everyone</strong> — no enrollment or payment
              needed. Browse any subject below.
            </div>
          </div>

          {subjects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
              <Library size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
              <div style={{ fontSize: '14px' }}>No subjects available yet. Check back soon.</div>
            </div>
          ) : (
            <div className="r-grid-2">
              {subjects.map(s => {
                const count = noteCountBySubject[s.id] ?? 0
                return (
                  <Link key={s.id} href={`/free-notes/${s.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                    <div className="card" style={{ padding: '22px', height: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                          background: 'var(--accent-2-dim)', color: 'var(--accent-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Library size={16}/>
                        </div>
                        <span className="pill" style={{ background: 'var(--accent-2-dim)', color: 'var(--accent-2)' }}>Free</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '17px', color: 'var(--text)', marginBottom: '8px' }}>
                        {s.name}
                      </div>
                      {s.description && (
                        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '16px' }}>
                          {s.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted2)' }}>
                          {count} note{count !== 1 ? 's' : ''}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-2)' }}>
                          Browse <ArrowRight size={13}/>
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
