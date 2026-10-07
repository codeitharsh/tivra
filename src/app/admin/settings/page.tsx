export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
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
    <AuthShell profile={profile} title="Settings" subtitle="Platform configuration and domain records" maxWidth={700}>
          <SettingsClient colleges={(collegesRaw ?? []) as Record<string,unknown>[]}/>
    </AuthShell>
  )
}
