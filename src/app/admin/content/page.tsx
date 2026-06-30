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

  // Fetch every programme's phases/modules — this page is a separate,
  // admin-only duplicate of teacher/content/page.tsx and had the exact
  // same hardcoded cloud-launchpad bug, just never caught until a real
  // `tsc --noEmit` type-check surfaced the mismatch against
  // ContentUploadClient's Phase type (which already expects programme
  // info, since the teacher-facing copy was fixed first).
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

  const total    = phases.reduce((acc,p)=>acc+p.modules.length,0)
  const uploaded = phases.reduce((acc,p)=>acc+p.modules.filter(m=>m.notes_url).length,0)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Content Management" subtitle={`${uploaded}/${total} modules have notes uploaded`}/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <ContentUploadClient phases={phases}/>
        </div>
      </main>
    </div>
  )
}
