export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import ProgramsManagerClient from './ProgramsManagerClient'
import type { Profile } from '@/types/database'

export default async function AdminProgramsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data } = await admin
    .from('programs')
    .select('id, name, slug, price_inr, original_price_inr, duration_label, is_active, curriculum_url, mode, placement_assistance')
    .order('display_order', { ascending: true })

  const programs = (data ?? []) as {
    id: string; name: string; slug: string
    price_inr: number | null; original_price_inr: number | null; duration_label: string | null
    is_active: boolean; curriculum_url: string | null
    mode: string; placement_assistance: boolean
  }[]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title="Programmes"
          subtitle="Manage pricing, duration, mode, and curriculum PDFs — the single source of truth for the whole site"
        />
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <ProgramsManagerClient programs={programs}/>
        </div>
      </main>
    </div>
  )
}
