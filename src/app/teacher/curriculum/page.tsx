export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CurriculumEditorClient from './CurriculumEditorClient'
import type { Profile } from '@/types/database'

export default async function TeacherCurriculumPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: progData } = await admin
    .from('programs').select('id, name').eq('slug', 'cloud-launchpad').single()
  const program = progData as { id: string; name: string } | null

  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, description, modules(id, title, module_number, notes_url, is_unlocked)')
    .eq('program_id', program?.id ?? '')
    .order('phase_number')

  const phases = (phasesRaw ?? []) as {
    id: string; title: string; phase_number: number; description: string | null
    modules: { id: string; title: string; module_number: number; notes_url: string | null; is_unlocked: boolean }[]
  }[]

  // Sort modules
  phases.forEach(p => {
    p.modules = (p.modules ?? []).sort((a, b) => a.module_number - b.module_number)
  })

  const totalModules = phases.reduce((acc, p) => acc + p.modules.length, 0)
  const withNotes    = phases.reduce((acc, p) => acc + p.modules.filter(m => m.notes_url).length, 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title="Curriculum Editor"
          subtitle={`${totalModules} modules · ${withNotes} with notes · Cloud LaunchPad`}
        />
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <CurriculumEditorClient phases={phases} programId={program?.id ?? ''}/>
        </div>
      </main>
    </div>
  )
}
