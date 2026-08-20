export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import AccessTable from './AccessTable'
import type { Profile } from '@/types/database'
import { Info } from 'lucide-react'

export default async function AdminAccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  // All five queries below are independent of each other (none needs
  // another's result), so they were previously firing as a sequential
  // waterfall — each awaited one at a time — meaning this page's load
  // time was the SUM of all five round-trips instead of just the
  // slowest one. Promise.all runs them concurrently instead.
  const [
    { data: allUsers },
    { data: progressCounts },
    { data: programsRaw },
    { data: batchesRaw },
    { data: paymentRequests },
  ] = await Promise.all([
    // Fetch ALL users (not just students) — exclude only the current admin
    admin
      .from('profiles')
      .select(`
        id, full_name, email, role, access_type, access_status,
        phone, streak_count, created_at,
        payment_verified_at, payment_notes,
        college_id, enrolled_program_id
      `)
      .neq('id', user.id)          // don't show yourself
      .order('created_at', { ascending: false }),

    // Module progress counts
    admin
      .from('module_progress')
      .select('student_id')
      .eq('status', 'completed'),

    // All programmes for the Grant-access modal's programme picker —
    // includes inactive/unpublished ones too (unlike the public site),
    // since an admin may want to grant access ahead of a launch.
    admin
      .from('programs')
      .select('slug, name')
      .order('display_order', { ascending: true }),

    // All batches for the Grant-access modal's optional batch picker —
    // batch assignment previously had no UI anywhere in the app, even
    // though batch-scoped live classes depend on a student's profile
    // having the right batch_id set.
    admin
      .from('batches')
      .select('id, name, batch_type, status')
      .order('name', { ascending: true }),

    // Latest payment requests
    admin
      .from('payment_requests')
      .select('student_id, status, transaction_ref, created_at')
      .order('created_at', { ascending: false }),
  ])

  const progressMap: Record<string, number> = {}
  for (const p of (progressCounts ?? []) as { student_id: string }[]) {
    progressMap[p.student_id] = (progressMap[p.student_id] ?? 0) + 1
  }

  const programmes = (programsRaw ?? []) as { slug: string; name: string }[]
  const batches = (batchesRaw ?? []) as { id: string; name: string; batch_type: string; status: string }[]

  const paymentMap: Record<string, { status: string; transaction_ref: string | null }> = {}
  for (const pr of (paymentRequests ?? []) as {
    student_id: string; status: string; transaction_ref: string | null
  }[]) {
    if (!paymentMap[pr.student_id]) {
      paymentMap[pr.student_id] = { status: pr.status, transaction_ref: pr.transaction_ref }
    }
  }

  // Build enriched rows
  type EnrichedRow = Record<string, unknown>
  const rows: EnrichedRow[] = ((allUsers ?? []) as Record<string, unknown>[]).map(u => ({
    ...u,
    modules_done:     progressMap[u.id as string] ?? 0,
    progress_percent: Math.round(((progressMap[u.id as string] ?? 0) / 24) * 100),
    payment_request_status: paymentMap[u.id as string]?.status ?? null,
    transaction_ref:        paymentMap[u.id as string]?.transaction_ref ?? null,
  }))

  // Stats — all users
  const pending    = rows.filter(r => r.access_status === 'pending_payment').length
  const active     = rows.filter(r => r.access_status === 'active').length
  const restricted = rows.filter(r => r.access_status === 'restricted').length

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar
          title="Access Management"
          subtitle="Grant, revoke, and manage roles for all users"
        />

        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          {/* Stats */}
          <div className='r-grid-4' style={{ marginBottom:'24px' }}>
            {[
              { label:'Total users',      value:rows.length, color:'var(--accent-2)' },
              { label:'Pending approval', value:pending,     color:'var(--amber)'   },
              { label:'Active',           value:active,      color:'var(--green)'   },
              { label:'Restricted',       value:restricted,  color:'var(--red)'     },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="banner banner-brand">
            <Info size={16} style={{ flexShrink:0 }}/>
            <div style={{ fontSize:'13px' }}>
              <strong style={{ color:'var(--text)' }}>All users are shown here</strong> — students, teachers, parents, and admins.
              Use the role dropdown to change any user&apos;s role, and Grant / Revoke to control access.
            </div>
          </div>

          <AccessTable rows={rows} programmes={programmes} batches={batches}/>
        </div>
      </main>
    </div>
  )
}
