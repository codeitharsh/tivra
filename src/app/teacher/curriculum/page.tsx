export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CurriculumEditorClient from './CurriculumEditorClient'
import type { Profile } from '@/types/database'

export default async function TeacherCurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { program: requestedSlug } = await searchParams

  // Previously hardcoded to a single 'cloud-launchpad' lookup — a
  // teacher could never edit Cloud Architect's curriculum through
  // this page. Now fetches every active programme and lets the
  // teacher switch between them; defaults to the first one
  // alphabetically if none is specified in the URL.
  const { data: allProgramsRaw } = await admin
    .from('programs')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')

  const allPrograms = (allProgramsRaw ?? []) as { id: string; name: string; slug: string }[]

  const selectedProgram = requestedSlug
    ? allPrograms.find(p => p.slug === requestedSlug) ?? allPrograms[0]
    : allPrograms[0]

  const phasesQuery = selectedProgram ? await admin
    .from('phases')
    .select('id, title, phase_number, description, modules(id, title, module_number, notes_url, is_unlocked)')
    .eq('program_id', selectedProgram.id)
    .order('phase_number') : { data: [] }

  const phases = (phasesQuery.data ?? []) as {
    id: string; title: string; phase_number: number; description: string | null
    modules: { id: string; title: string; module_number: number; notes_url: string | null; is_unlocked: boolean }[]
  }[]

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
          subtitle={selectedProgram ? `${totalModules} modules · ${withNotes} with notes · ${selectedProgram.name}` : 'No programmes found'}
        />
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

          {allPrograms.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {allPrograms.map(p => (
                <Link
                  key={p.id}
                  href={`/teacher/curriculum?program=${p.slug}`}
                  className={p.id === selectedProgram?.id ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{ fontSize: '13px' }}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}

          {selectedProgram ? (
            <CurriculumEditorClient phases={phases} programId={selectedProgram.id}/>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              No active programmes found. Create one in the admin panel first.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
