export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import DoubtsClient from '@/app/doubts/DoubtsClient'
import type { Profile } from '@/types/database'

export default async function TeacherDoubtsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin','teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: doubtsRaw } = await admin
    .from('doubts')
    .select(`
      id, question_text, upvotes, is_resolved, created_at, module_id,
      profiles!student_id (id, full_name),
      modules!module_id (title, module_number),
      doubt_answers (
        id, answer_text, created_at,
        profiles!answered_by (full_name, role)
      )
    `)
    .order('is_resolved')
    .order('created_at', { ascending: false })

  const { data: modsRaw } = await admin
    .from('modules').select('id, title').order('module_number')

  const doubts  = (doubtsRaw ?? []) as Record<string, unknown>[]
  const modules = (modsRaw   ?? []) as { id: string; title: string }[]

  return (
    <AuthShell profile={profile} title="Resolve Doubts" subtitle={`${doubts.filter(d => !d.is_resolved).length} open doubts waiting`}>
          <DoubtsClient
            doubts={doubts}
            modules={modules}
            userRole={profile.role ?? 'teacher'}
          />
    </AuthShell>
  )
}
