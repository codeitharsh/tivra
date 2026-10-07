export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
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
      reviewed_at, reviewed_by, plan,
      profiles!student_id (full_name, email, phone)
    `)
    .order('created_at', { ascending: false })

  const rows = (requestsRaw ?? []) as Record<string, unknown>[]
  const pending  = rows.filter(r => r.status === 'pending').length
  const approved = rows.filter(r => r.status === 'approved').length
  const rejected = rows.filter(r => r.status === 'rejected').length

  return (
    <AuthShell profile={profile} title="Payment Requests" subtitle="Review and approve student payment submissions">

          {/* Stats */}
          <div className='r-grid-3' style={{ marginBottom:'24px' }}>
            {[
              { label:'Pending review', value:pending,  color:'var(--amber-text)' },
              { label:'Approved',       value:approved, color:'var(--green-text)' },
              { label:'Rejected',       value:rejected, color:'var(--red-text)'   },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <PaymentsClient rows={rows}/>
    </AuthShell>
  )
}
