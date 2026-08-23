export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import { FileText, Download, ChevronRight } from 'lucide-react'

export default async function FreeNoteViewerPage({
  params,
}: {
  params: Promise<{ subjectSlug: string; noteId: string }>
}) {
  const { subjectSlug, noteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  const { data: subjectRow } = await admin
    .from('subjects')
    .select('id, name, slug')
    .eq('slug', subjectSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (!subjectRow) notFound()
  const subject = subjectRow as { id: string; name: string; slug: string }

  const { data: noteRow } = await admin
    .from('free_notes')
    .select('id, title, note_number, notes_url, subject_id')
    .eq('id', noteId)
    .maybeSingle()

  if (!noteRow) notFound()
  const note = noteRow as { id: string; title: string; note_number: number; notes_url: string | null; subject_id: string }

  // Cross-check: this note must actually belong to the subject resolved
  // from the URL slug — same reasoning as the paid content viewer's
  // module/programme cross-check.
  if (note.subject_id !== subject.id) notFound()

  let signedUrl: string | null = null
  if (note.notes_url) {
    const { data: urlData } = await admin.storage
      .from('free-notes')
      .createSignedUrl(note.notes_url, 3600)
    signedUrl = urlData?.signedUrl ?? null
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title={note.title} subtitle={subject.name}/>
        <div style={{ padding:'28px', maxWidth:'900px' }}>

          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--muted)', marginBottom:'20px' }}>
            <Link href="/free-notes" style={{ color:'var(--muted)', textDecoration:'none' }}>Free Notes</Link>
            <ChevronRight size={13}/>
            <Link href={`/free-notes/${subject.slug}`} style={{ color:'var(--muted)', textDecoration:'none' }}>{subject.name}</Link>
            <ChevronRight size={13}/>
            <span style={{ color:'var(--text)' }}>{note.title}</span>
          </div>

          {signedUrl ? (
            <div className="card" style={{ marginBottom: '20px', padding: '0', overflow: 'hidden' }}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '14px', display:'flex', alignItems:'center', gap:'8px' }}>
                  <FileText size={15}/> {note.title}
                </div>
                <a
                  href={signedUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  <Download size={13}/> Download PDF
                </a>
              </div>
              <iframe
                src={signedUrl}
                style={{ width: '100%', height: '600px', border: 'none', display: 'block' }}
                title={note.title}
              />
            </div>
          ) : (
            <div className="card" style={{
              marginBottom: '20px', textAlign: 'center', padding: '48px',
              background: 'var(--card2)',
            }}>
              <FileText size={28} color="var(--muted2)" style={{ marginBottom: '12px' }}/>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>
                Notes not uploaded yet
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Check back soon — this note is being prepared.
              </div>
            </div>
          )}

          <Link href={`/free-notes/${subject.slug}`} className="btn btn-ghost" style={{ fontSize: '13px' }}>
            ← Back to {subject.name}
          </Link>
        </div>
      </main>
    </div>
  )
}
