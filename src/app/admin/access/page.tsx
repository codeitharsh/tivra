import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import AccessTable from './AccessTable'
import type { Profile } from '@/types/database'

export default async function AdminAccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch ALL users (not just students) — exclude only the current admin
  const { data: allUsers } = await admin
    .from('profiles')
    .select(`
      id, full_name, email, role, access_type, access_status,
      phone, streak_count, created_at,
      payment_verified_at, payment_notes,
      college_id, enrolled_program_id
    `)
    .neq('id', user.id)          // don't show yourself
    .order('created_at', { ascending: false })

  // Fetch module progress counts separately
  const { data: progressCounts } = await admin
    .from('module_progress')
    .select('student_id')
    .eq('status', 'completed')

  const progressMap: Record<string, number> = {}
  for (const p of (progressCounts ?? []) as { student_id: string }[]) {
    progressMap[p.student_id] = (progressMap[p.student_id] ?? 0) + 1
  }

  // Fetch latest payment requests
  const { data: paymentRequests } = await admin
    .from('payment_requests')
    .select('student_id, status, transaction_ref, created_at')
    .order('created_at', { ascending: false })

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
          <div className='r-grid-4' style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
            {[
              { label:'Total Users',      value:rows.length, color:'var(--cyan)',  bg:'rgba(0,200,248,0.08)',  border:'rgba(0,200,248,0.2)'  },
              { label:'Pending Approval', value:pending,     color:'var(--amber)', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)' },
              { label:'Active',           value:active,      color:'var(--green)', bg:'rgba(34,197,94,0.08)',  border:'rgba(34,197,94,0.2)'  },
              { label:'Restricted',       value:restricted,  color:'var(--red)',   bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.2)'  },
            ].map(s => (
              <div key={s.label} style={{
                background:s.bg, border:`1px solid ${s.border}`,
                borderRadius:'var(--radius)', padding:'16px 20px',
              }}>
                <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>
                  {s.label}
                </div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'28px', color:s.color, lineHeight:1 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="banner banner-brand" style={{ marginBottom:'24px' }}>
            <span style={{ fontSize:'18px', flexShrink:0 }}>ℹ️</span>
            <div style={{ fontSize:'13px' }}>
              <strong style={{ color:'#fff' }}>All users are shown here</strong> — students, teachers, parents, and admins.
              Use the role dropdown to change any user&apos;s role, and Grant / Revoke to control access.
            </div>
          </div>

          <AccessTable rows={rows} adminId={user.id}/>
        </div>
      </main>
    </div>
  )
}
