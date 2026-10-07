export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import BatchManagerClient from './BatchManagerClient'
import type { Profile } from '@/types/database'

export default async function AdminBatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch programs
  const { data: programs } = await admin
    .from('programs').select('id, name, slug').order('name')
  const programList = (programs ?? []) as { id: string; name: string; slug: string }[]

  // Fetch all batches with student counts
  const { data: batchesRaw } = await admin
    .from('batches')
    .select('*, programs!program_id(name, slug)')
    .order('created_at', { ascending: false })

  const batches = (batchesRaw ?? []) as Record<string, unknown>[]

  // Student counts per batch
  const { data: batchCounts } = await admin
    .from('profiles')
    .select('batch_id')
    .not('batch_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const p of (batchCounts ?? []) as { batch_id: string }[])
    countMap[p.batch_id] = (countMap[p.batch_id] ?? 0) + 1

  type EnrichedBatch = Record<string,unknown>
  const enriched: EnrichedBatch[] = batches.map(b => ({
    ...b,
    student_count: countMap[b.id as string] ?? 0,
  }))

  // Stats
  const active   = enriched.filter(b => b.status === 'active').length
  const upcoming = enriched.filter(b => b.status === 'upcoming').length
  const total    = enriched.length

  return (
    <AuthShell profile={profile} title="Batch Management" subtitle="Create and manage cohorts — open batches and private group batches">

          {/* Stats */}
          <div className="r-grid-3" style={{ marginBottom: '24px' }}>
            {[
              { label: 'Total batches',   value: total,   color: 'var(--accent-2)' },
              { label: 'Active now',      value: active,  color: 'var(--green)'    },
              { label: 'Upcoming',        value: upcoming, color: 'var(--amber)'   },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <BatchManagerClient
            batches={enriched}
            programs={programList}
            adminId={user.id}
          />
    </AuthShell>
  )
}
