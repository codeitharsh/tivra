export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import LiveSessionsClient from '@/app/teacher/live/LiveSessionsClient'
import type { Profile } from '@/types/database'

export default async function AdminLivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: sessionsRaw } = await admin
    .from('live_sessions')
    .select('*, phases!phase_id(title, phase_number), batches!batch_id(name, batch_type, status)')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number, modules(id, title, module_number)')
    .order('phase_number')

  const { data: batchesRaw } = await admin
    .from('batches')
    .select('id, name, batch_type, status')
    .in('status', ['active', 'upcoming'])
    .order('name')

  const batches = (batchesRaw ?? []) as { id: string; name: string; batch_type: string; status: string }[]

  return (
    <AuthShell profile={profile} title="Live Sessions" subtitle="Schedule and manage all live classes">
          <LiveSessionsClient
            sessions={(sessionsRaw ?? []) as Record<string, unknown>[]}
            phases={(phasesRaw ?? []) as Record<string, unknown>[]}
            batches={batches}
          />
    </AuthShell>
  )
}
