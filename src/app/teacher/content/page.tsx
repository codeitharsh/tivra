export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import ContentUploadClient from './ContentUploadClient'
import type { Profile } from '@/types/database'

export default async function TeacherContentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin','teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch every programme's phases/modules — previously this was
  // hardcoded to cloud-launchpad only, meaning Cloud Architect's
  // modules were never shown here and could never have notes
  // uploaded or deleted through this page at all.
  const { data: phasesRaw } = await admin
    .from('phases')
    .select(`
      id, title, phase_number, program_id,
      programs!program_id (name, slug),
      modules (id, title, module_number, notes_url)
    `)
    .order('program_id')
    .order('phase_number')

  const phases = (phasesRaw ?? []) as {
    id: string; title: string; phase_number: number; program_id: string
    programs: { name: string; slug: string } | null
    modules: { id: string; title: string; module_number: number; notes_url: string|null }[]
  }[]

  phases.forEach(p => { p.modules = (p.modules??[]).sort((a,b)=>a.module_number-b.module_number) })

  const totalModules  = phases.reduce((acc,p) => acc + p.modules.length, 0)
  const uploadedCount = phases.reduce((acc,p) => acc + p.modules.filter(m=>m.notes_url).length, 0)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Upload Notes" subtitle={`${uploadedCount}/${totalModules} modules have notes uploaded`}/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <ContentUploadClient phases={phases}/>
        </div>
      </main>
    </div>
  )
}
