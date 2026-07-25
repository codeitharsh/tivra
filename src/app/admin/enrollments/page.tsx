export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

export default async function AdminEnrollmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data } = await admin
    .from('enrolled_programs')
    .select('id, amount_paid, enrolled_at, access_granted_at, profiles(full_name, email), programs(name, slug)')
    .order('enrolled_at', { ascending: false })

  const enrollments = (data ?? []) as unknown as {
    id: string; amount_paid: number | null; enrolled_at: string; access_granted_at: string | null
    profiles: { full_name: string | null; email: string | null } | null
    programs: { name: string; slug: string } | null
  }[]

  const totalRevenue = enrollments.reduce((sum, e) => sum + (e.amount_paid ?? 0), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title="Enrollments"
          subtitle={`${enrollments.length} enrollments · ₹${totalRevenue.toLocaleString('en-IN')} total`}
        />
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Programme</th>
                    <th>Amount Paid</th>
                    <th>Enrolled</th>
                    <th>Access Granted</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>No enrollments yet.</td></tr>
                  )}
                  {enrollments.map((e, i) => (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{e.profiles?.full_name ?? '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{e.profiles?.email ?? ''}</div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{e.programs?.name ?? '—'}</td>
                      <td style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green)' }}>
                        {e.amount_paid != null ? `₹${e.amount_paid.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {new Date(e.enrolled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {e.access_granted_at ? new Date(e.access_granted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
