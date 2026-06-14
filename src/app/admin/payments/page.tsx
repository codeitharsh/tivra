export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import PaymentsClient from './PaymentsClient'
import type { Profile } from '@/types/database'

export default async function AdminPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: requestsRaw } = await admin
    .from('payment_requests')
    .select(`
      id, student_id, amount, payment_method, transaction_ref,
      screenshot_url, status, rejection_note, created_at,
      reviewed_at, reviewed_by,
      profiles!student_id (full_name, email, phone)
    `)
    .order('created_at', { ascending: false })

  const rows = (requestsRaw ?? []) as Record<string, unknown>[]
  const pending  = rows.filter(r => r.status === 'pending').length
  const approved = rows.filter(r => r.status === 'approved').length
  const rejected = rows.filter(r => r.status === 'rejected').length

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Payment Requests" subtitle="Review and approve student payment submissions"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          {/* Stats */}
          <div className='r-grid-3' style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'24px' }}>
            {[
              { label:'Pending Review', value:pending,  color:'var(--amber)', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)' },
              { label:'Approved',       value:approved, color:'var(--green)', bg:'rgba(34,197,94,0.08)',  border:'rgba(34,197,94,0.2)'  },
              { label:'Rejected',       value:rejected, color:'var(--red)',   bg:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.2)'  },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:'var(--radius)', padding:'16px 20px' }}>
                <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>{s.label}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'28px', color:s.color, lineHeight:1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <PaymentsClient rows={rows} adminId={user.id}/>
        </div>
      </main>
    </div>
  )
}
