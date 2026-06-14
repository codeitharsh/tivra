export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import SettingsClient from './SettingsClient'
import type { Profile } from '@/types/database'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: collegesRaw } = await admin
    .from('approved_colleges').select('id, college_name, email_domain').order('college_name')

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Settings" subtitle="Platform configuration and domain records"/>
        <div style={{ padding:'28px', maxWidth:'700px' }}>
          <SettingsClient colleges={(collegesRaw ?? []) as Record<string,unknown>[]}/>
        </div>
      </main>
    </div>
  )
}
