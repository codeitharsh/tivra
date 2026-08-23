export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import { FileText, ChevronRight, ArrowRight } from 'lucide-react'

export default async function FreeNotesSubjectPage({
  params,
}: {
  params: Promise<{ subjectSlug: string }>
}) {
  const { subjectSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  const { data: subjectRow } = await admin
    .from('subjects')
    .select('id, name, slug, description')
    .eq('slug', subjectSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (!subjectRow) notFound()
  const subject = subjectRow as { id: string; name: string; slug: string; description: string | null }

  const { data: notesRaw } = await admin
    .from('free_notes')
    .select('id, title, note_number, notes_url')
    .eq('subject_id', subject.id)
    .order('note_number')

  const notes = (notesRaw ?? []) as { id: string; title: string; note_number: number; notes_url: string | null }[]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title={subject.name} subtitle={subject.description ?? 'Free self-study notes'}/>
        <div style={{ padding:'28px', maxWidth:'860px', margin:'0 auto', width:'100%' }}>

          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--muted)', marginBottom:'20px' }}>
            <Link href="/free-notes" style={{ color:'var(--muted)', textDecoration:'none' }}>Free Notes</Link>
            <ChevronRight size={13}/>
            <span style={{ color:'var(--text)' }}>{subject.name}</span>
          </div>

          {notes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
              <FileText size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
              <div style={{ fontSize: '14px' }}>No notes uploaded for this subject yet. Check back soon.</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {notes.map((n, i) => (
                <Link
                  key={n.id}
                  href={`/free-notes/${subject.slug}/${n.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                    padding: '16px 20px', textDecoration: 'none', color: 'inherit',
                    borderBottom: i < notes.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <span style={{
                      width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                      background: 'var(--card2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', color: 'var(--muted)',
                    }}>{n.note_number}</span>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{n.title}</div>
                  </div>
                  {n.notes_url ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-2)', flexShrink: 0 }}>
                      View <ArrowRight size={12}/>
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--muted2)', flexShrink: 0 }}>Coming soon</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
