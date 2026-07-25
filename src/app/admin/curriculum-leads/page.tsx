export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CurriculumLeadsClient from './CurriculumLeadsClient'
import type { Profile } from '@/types/database'

export default async function AdminCurriculumLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data } = await admin
    .from('curriculum_leads')
    .select('id, full_name, email, phone, college_name, graduation_year, current_status, created_at, programs(name)')
    .order('created_at', { ascending: false })

  const leads = (data ?? []) as unknown as {
    id: string; full_name: string; email: string; phone: string
    college_name: string | null; graduation_year: number | null
    current_status: string | null; created_at: string
    programs: { name: string } | null
  }[]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title="Curriculum Leads"
          subtitle={`${leads.length} curriculum download requests`}
        />
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <CurriculumLeadsClient leads={leads}/>
        </div>
      </main>
    </div>
  )
}
