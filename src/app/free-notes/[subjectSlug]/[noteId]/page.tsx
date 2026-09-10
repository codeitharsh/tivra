export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import TopicReaderClient from '@/components/free-notes/TopicReaderClient'
import { getSubjectProgress } from '@/lib/free-notes-progress'
import type { Profile } from '@/types/database'

interface NoteRow { id: string; title: string; note_number: number; notes_url: string | null }

export default async function FreeNoteViewerPage({
  params,
}: {
  params: Promise<{ subjectSlug: string; noteId: string }>
}) {
  const { subjectSlug, noteId } = await params

  // Unlike browsing the syllabus, actually opening a topic's PDF still
  // requires login (middleware.ts STEP 1d only carves out the 2-segment
  // /free-notes and /free-notes/{subjectSlug} paths).
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

  const { data: notesRaw } = await admin
    .from('free_notes')
    .select('id, title, note_number, notes_url')
    .eq('subject_id', subject.id)
    .order('note_number')
  const allNotes = (notesRaw ?? []) as NoteRow[]

  const note = allNotes.find(n => n.id === noteId)
  if (!note) notFound()

  const currentIndex = allNotes.findIndex(n => n.id === noteId)
  const prevNoteId = currentIndex > 0 ? allNotes[currentIndex - 1].id : null
  const nextNoteId = currentIndex < allNotes.length - 1 ? allNotes[currentIndex + 1].id : null

  const progress = await getSubjectProgress(admin, user.id, subject.id)

  let signedUrl: string | null = null
  if (note.notes_url) {
    const { data: urlData } = await admin.storage
      .from('free-notes')
      .createSignedUrl(note.notes_url, 3600)
    signedUrl = urlData?.signedUrl ?? null
  }

  const tocTopics = allNotes.map(n => ({ id: n.id, title: n.title, noteNumber: n.note_number }))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <TopicReaderClient
        subjectSlug={subject.slug}
        subjectName={subject.name}
        tocTopics={tocTopics}
        currentNoteId={note.id}
        currentNoteTitle={note.title}
        prevNoteId={prevNoteId}
        nextNoteId={nextNoteId}
        signedUrl={signedUrl}
        initialCompletedNoteIds={[...progress.completedNoteIds]}
        initialPercent={progress.percent}
        initialTotal={progress.total}
        initialCompleted={progress.completed}
      />
    </div>
  )
}
