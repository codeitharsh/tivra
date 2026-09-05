export const runtime = 'edge'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import PublicNav from '@/components/PublicNav'
import { getSubjectProgress } from '@/lib/free-notes-progress'
import type { Profile } from '@/types/database'
import { FileText, ChevronRight, CheckCircle2, Circle, ArrowRight } from 'lucide-react'

interface UnitRow { id: string; title: string; unit_number: number }
interface NoteRow { id: string; unit_id: string; title: string; note_number: number; notes_url: string | null }

export default async function FreeNotesSubjectPage({
  params,
}: {
  params: Promise<{ subjectSlug: string }>
}) {
  const { subjectSlug } = await params

  // Browsing a subject's syllabus is public (middleware.ts STEP 1d) —
  // only opening a topic's actual PDF requires login. So the user
  // lookup here is optional: it only decides which chrome to show and
  // whether to fetch/display personal progress.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile: Profile | null = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = p as Profile | null
  }

  const admin = createAdminClient()

  const { data: subjectRow } = await admin
    .from('subjects')
    .select('id, name, slug, description')
    .eq('slug', subjectSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (!subjectRow) notFound()
  const subject = subjectRow as { id: string; name: string; slug: string; description: string | null }

  const { data: unitsRaw } = await admin
    .from('units')
    .select('id, title, unit_number')
    .eq('subject_id', subject.id)
    .order('unit_number')

  const units = (unitsRaw ?? []) as UnitRow[]
  const unitIds = units.map(u => u.id)

  const { data: notesRaw } = unitIds.length > 0 ? await admin
    .from('free_notes')
    .select('id, unit_id, title, note_number, notes_url')
    .in('unit_id', unitIds)
    .order('note_number') : { data: [] }

  const notes = (notesRaw ?? []) as NoteRow[]
  const totalTopics = notes.length

  let progress: { total: number; completed: number; percent: number; completedNoteIds: Set<string> } | null = null
  if (user) {
    progress = await getSubjectProgress(admin, user.id, subject.id)
  }

  const body = (
    <div style={{ padding: '28px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
        <Link href="/free-notes" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Handwritten Notes</Link>
        <ChevronRight size={13}/>
        <span style={{ color: 'var(--text)' }}>{subject.name}</span>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '26px', color: 'var(--text)', marginBottom: '6px' }}>
          {subject.name}
        </h1>
        {subject.description && (
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: progress ? '16px' : 0 }}>{subject.description}</p>
        )}
        {progress && totalTopics > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
              <span>{subject.name} progress</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{progress.completed} / {progress.total} topics completed</span>
            </div>
            <div style={{ height: '6px', borderRadius: '4px', background: 'var(--card2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress.percent}%`, background: 'var(--accent-2)', borderRadius: '4px' }}/>
            </div>
          </div>
        )}
      </div>

      {totalTopics === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
          <FileText size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
          <div style={{ fontSize: '14px' }}>No topics uploaded for this subject yet. Check back soon.</div>
        </div>
      ) : (
        units.map(u => {
          const unitNotes = notes.filter(n => n.unit_id === u.id)
          if (unitNotes.length === 0) return null
          return (
            <div key={u.id} style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', color: 'var(--text)', marginBottom: '10px' }}>
                Unit {u.unit_number}: {u.title}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {unitNotes.map((n, i) => {
                  const done = progress?.completedNoteIds.has(n.id) ?? false
                  return (
                    <Link
                      key={n.id}
                      href={`/free-notes/${subject.slug}/${n.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                        padding: '14px 20px', textDecoration: 'none', color: 'inherit',
                        borderBottom: i < unitNotes.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {progress
                          ? (done
                              ? <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0 }}/>
                              : <Circle size={16} style={{ flexShrink: 0, opacity: 0.35 }}/>)
                          : <span style={{
                              width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                              background: 'var(--card2)', border: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', color: 'var(--muted)',
                            }}>{n.note_number}</span>}
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
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  if (profile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar profile={profile}/>
        <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
          <Topbar title={subject.name} subtitle={subject.description ?? 'Free self-study notes'}/>
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
