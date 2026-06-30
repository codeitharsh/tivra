export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import LiveSessionsClient from './LiveSessionsClient'
import type { Profile } from '@/types/database'

export default async function TeacherLivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin','teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: sessionsRaw } = await admin
    .from('live_sessions')
    .select('*, phases!phase_id(title, phase_number), batches!batch_id(name, batch_type, status)')
    .order('scheduled_at', { ascending: false })
    .limit(30)

  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, modules(id, title, module_number)')
    .order('phase_number')

  // Fetch active + upcoming batches for the dropdown
  const { data: batchesRaw } = await admin
    .from('batches')
    .select('id, name, batch_type, status')
    .in('status', ['active', 'upcoming'])
    .order('name')

  const sessions = (sessionsRaw ?? []) as Record<string, unknown>[]
  const phases   = (phasesRaw   ?? []) as Record<string, unknown>[]
  const batches  = (batchesRaw  ?? []) as { id: string; name: string; batch_type: string; status: string }[]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Live Sessions" subtitle="Schedule and manage your live classes"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <LiveSessionsClient
            sessions={sessions}
            phases={phases}
            batches={batches}
          />
        </div>
      </main>
    </div>
  )
}
