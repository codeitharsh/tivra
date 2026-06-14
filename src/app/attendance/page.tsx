export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null

  const admin = createAdminClient()

  const { data: records } = await admin
    .from('attendance_records')
    .select('*, live_sessions!session_id(title, scheduled_at, duration_minutes)')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (records ?? []) as Record<string, unknown>[]

  const total   = rows.length
  const present = rows.filter(r => r.status === 'present' || r.status === 'late').length
  const partial = rows.filter(r => r.status === 'partial').length
  const pct     = total > 0 ? Math.round(((present + partial * 0.5) / total) * 100) : 0

  const statusColor: Record<string, string> = {
    present: 'var(--green)', partial: 'var(--amber)',
    absent: 'var(--red)', late: 'var(--cyan)',
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="My Attendance" subtitle="Recorded automatically when you join live classes"/>
        <div style={{ padding:'28px', maxWidth:'800px' }}>

          {/* Attendance rate */}
          <div style={{
            background: pct >= 75 ? 'rgba(34,197,94,0.07)' : 'rgba(245,158,11,0.07)',
            border: `1px solid ${pct >= 75 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
            borderRadius:'var(--radius)', padding:'20px', marginBottom:'24px',
            display:'flex', alignItems:'center', gap:'20px',
          }}>
            <div style={{
              fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'48px',
              color: pct >= 75 ? 'var(--green)' : 'var(--amber)', lineHeight:1,
            }}>{pct}%</div>
            <div>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'16px', marginBottom:'4px' }}>
                Overall Attendance
              </div>
              <div style={{ fontSize:'13px', color:'var(--muted)' }}>
                {present} present · {partial} partial · {total - present - partial} absent
              </div>
              {pct < 75 && (
                <div style={{ fontSize:'12px', color:'var(--amber)', marginTop:'6px' }}>
                  ⚠️ Below 75% threshold — required to unlock phase assessments
                </div>
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'48px', color:'var(--muted)' }}>
              <div style={{ fontSize:'32px', marginBottom:'12px' }}>📋</div>
              <div style={{ fontSize:'14px' }}>No attendance records yet.</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>Join a live class to start building your attendance.</div>
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Date</th>
                    <th>Joined</th>
                    <th>Left</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const session = row.live_sessions as Record<string,unknown> | null
                    return (
                      <tr key={row.id as string}>
                        <td style={{ fontWeight:500, fontSize:'13px' }}>
                          {String(session?.title ?? '—')}
                        </td>
                        <td style={{ fontSize:'12px', color:'var(--muted)' }}>
                          {session?.scheduled_at
                            ? new Date(session.scheduled_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})
                            : '—'}
                        </td>
                        <td style={{ fontSize:'12px', color:'var(--muted)' }}>
                          {row.joined_at
                            ? new Date(row.joined_at as string).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
                            : '—'}
                        </td>
                        <td style={{ fontSize:'12px', color:'var(--muted)' }}>
                          {row.left_at
                            ? new Date(row.left_at as string).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
                            : '—'}
                        </td>
                        <td style={{ fontSize:'12px', color:'var(--muted)' }}>
                          {row.duration_minutes ? `${row.duration_minutes} min` : '—'}
                        </td>
                        <td>
                          <span style={{
                            padding:'3px 10px', borderRadius:'20px',
                            fontSize:'11px', fontWeight:600,
                            background:`${statusColor[row.status as string] ?? 'var(--muted)'}20`,
                            color: statusColor[row.status as string] ?? 'var(--muted)',
                          }}>
                            {String(row.status ?? 'absent').charAt(0).toUpperCase() + String(row.status ?? 'absent').slice(1)}
                          </span>
                          {row.is_override ? <span style={{ fontSize:'10px', color:'var(--muted)', marginLeft:'6px' }}>overridden</span> : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
