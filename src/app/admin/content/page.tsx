export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import ContentUploadClient from '@/app/teacher/content/ContentUploadClient'
import type { Profile } from '@/types/database'

export default async function AdminContentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, modules(id, title, module_number, notes_url)')
    .eq('program_id', ((await admin.from('programs').select('id').eq('slug','cloud-launchpad').single()).data as {id:string}|null)?.id ?? '')
    .order('phase_number')

  const phases = (phasesRaw ?? []) as {
    id: string; title: string; phase_number: number
    modules: { id: string; title: string; module_number: number; notes_url: string|null }[]
  }[]
  phases.forEach(p => { p.modules = (p.modules??[]).sort((a,b)=>a.module_number-b.module_number) })

  const total    = phases.reduce((acc,p)=>acc+p.modules.length,0)
  const uploaded = phases.reduce((acc,p)=>acc+p.modules.filter(m=>m.notes_url).length,0)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Content Management" subtitle={`${uploaded}/${total} modules have notes uploaded`}/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <ContentUploadClient phases={phases} userId={user.id}/>
        </div>
      </main>
    </div>
  )
}
