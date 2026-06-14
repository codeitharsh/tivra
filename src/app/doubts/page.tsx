import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import DoubtsClient from './DoubtsClient'
import type { Profile } from '@/types/database'

export default async function DoubtsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  // All doubts with answers and student info
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
    .order('created_at', { ascending: false })

  const doubts = (doubtsRaw ?? []) as Record<string, unknown>[]

  // All modules for filter dropdown
  const { data: modulesRaw } = await admin
    .from('modules')
    .select('id, title, module_number, phases!phase_id(phase_number)')
    .order('module_number')

  const modules = (modulesRaw ?? []) as Record<string, unknown>[]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Doubt Corner" subtitle="Post questions, get answers from your teacher"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <DoubtsClient
            doubts={doubts}
            modules={(modules as {id:string;title:string}[])}
            userId={user.id}
            userRole={profile.role ?? 'student'}
          />
        </div>
      </main>
    </div>
  )
}
