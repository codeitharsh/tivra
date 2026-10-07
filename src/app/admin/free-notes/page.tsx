export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import FreeNotesManagerClient from './FreeNotesManagerClient'
import type { Profile } from '@/types/database'

export default async function AdminFreeNotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: subjectsRaw } = await admin
    .from('subjects')
    .select('id, name, slug, description, is_active, display_order')
    .order('display_order')

  const { data: notesRaw } = await admin
    .from('free_notes')
    .select('id, subject_id, title, note_number, notes_url')
    .order('note_number')

  const subjects = (subjectsRaw ?? []) as {
    id: string; name: string; slug: string; description: string | null
    is_active: boolean; display_order: number
  }[]

  const notes = (notesRaw ?? []) as {
    id: string; subject_id: string; title: string; note_number: number; notes_url: string | null
  }[]

  return (
    <AuthShell profile={profile} title="Handwritten Notes" subtitle="Manage the self-study library — subjects and topics, open to every registered user">
          <FreeNotesManagerClient subjects={subjects} notes={notes}/>
    </AuthShell>
  )
}
