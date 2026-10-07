export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import ProfileEditClient from './ProfileEditClient'
import { requireActiveStudent } from '@/lib/access-gate'
import type { Profile } from '@/types/database'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  // Profile is intentionally accessible to ALL authenticated users
  // regardless of enrollment status — the brief explicitly lists it
  // as one of the pages available before enrollment. We still need
  // login (above) but NOT requireActiveStudent here.

  return (
    <AuthShell profile={profile} title="My Profile" subtitle="View and update your account details" maxWidth={640}>
          <ProfileEditClient profile={profile}/>
    </AuthShell>
  )
}
