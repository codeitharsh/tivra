export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import ReferralClient from './ReferralClient'
import type { Profile } from '@/types/database'

export default async function AdminReferralsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch all referral codes
  const { data: referralsRaw } = await admin
    .from('faculty_referrals')
    .select('*')
    .order('created_at', { ascending: false })

  const referrals = (referralsRaw ?? []) as {
    id: string; faculty_name: string; faculty_email: string | null
    referral_code: string; discount_amount: number
    is_active: boolean; created_at: string
  }[]

  // Fetch enrollment stats per referral code
  const { data: statsRaw } = await admin
    .from('payment_requests')
    .select('referral_id, status, amount')
    .not('referral_id', 'is', null)

  const stats: Record<string, { total: number; approved: number; revenue: number }> = {}
  for (const row of (statsRaw ?? []) as { referral_id: string; status: string; amount: number | null }[]) {
    if (!stats[row.referral_id]) stats[row.referral_id] = { total: 0, approved: 0, revenue: 0 }
    stats[row.referral_id].total++
    if (row.status === 'approved') {
      stats[row.referral_id].approved++
      stats[row.referral_id].revenue += row.amount ?? 0
    }
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Faculty Referrals" subtitle="Create referral codes, track enrollments and revenue per faculty"/>
        <div style={{ padding:'28px', maxWidth:'1100px', margin:'0 auto', width:'100%' }}>
          <ReferralClient referrals={referrals} stats={stats} adminId={user.id}/>
        </div>
      </main>
    </div>
  )
}
