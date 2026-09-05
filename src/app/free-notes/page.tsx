export const runtime = 'edge'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import PublicNav from '@/components/PublicNav'
import type { Profile } from '@/types/database'
import { Library, ArrowRight } from 'lucide-react'

interface SubjectRow {
  id: string; name: string; slug: string; description: string | null
}

export default async function FreeNotesPage() {
  // Browsing is public — anyone can see what subjects/notes exist (see
  // middleware.ts STEP 1d). Only opening an actual note's PDF requires
  // login. So the user/profile lookup here is optional, never a
  // redirect — it only decides which chrome to render.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile: Profile | null = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = p as Profile | null
  }

  const admin = createAdminClient()
  const { data: subjectsRaw } = await admin
    .from('subjects')
    .select('id, name, slug, description')
    .eq('is_active', true)
    .order('display_order')

  // free_notes has no direct subject_id — resolve topic counts per
  // subject via units first.
  const { data: unitsRaw } = await admin.from('units').select('id, subject_id')
  const subjectIdByUnitId: Record<string, string> = {}
  for (const u of (unitsRaw ?? []) as { id: string; subject_id: string }[]) {
    subjectIdByUnitId[u.id] = u.subject_id
  }

  const { data: countsRaw } = await admin.from('free_notes').select('unit_id')

  const noteCountBySubject: Record<string, number> = {}
  for (const n of (countsRaw ?? []) as { unit_id: string }[]) {
    const subjectId = subjectIdByUnitId[n.unit_id]
    if (!subjectId) continue
    noteCountBySubject[subjectId] = (noteCountBySubject[subjectId] ?? 0) + 1
  }

  const subjects = (subjectsRaw ?? []) as SubjectRow[]

  const body = (
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
                          {count} topic{count !== 1 ? 's' : ''}
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
  )

  if (profile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar profile={profile}/>
        <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
          <Topbar title="Handwritten Notes" subtitle="Self-study material for college exams and interview prep — open to everyone"/>
          {body}
        </main>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNav/>
      {body}
    </div>
  )
}
