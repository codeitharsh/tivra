export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import TestSchedulerClient from './TestSchedulerClient'
import type { Profile } from '@/types/database'

export default async function AdminTestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: prog } = await admin.from('programs').select('id').eq('slug','cloud-launchpad').single()

  const { data: testsRaw } = await admin
    .from('weekly_tests')
    .select('*, phases!phase_id(title, phase_number)')
    .eq('program_id', (prog as {id:string}|null)?.id ?? '')
    .order('phase_id').order('week_number')

  const tests = (testsRaw ?? []) as Record<string, unknown>[]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Test Scheduling" subtitle="Set unlock dates and manually override tests"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <TestSchedulerClient tests={tests}/>
        </div>
      </main>
    </div>
  )
}
