import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'
import Link from 'next/link'

export default async function AdminStudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: studentsRaw } = await admin
    .from('profiles')
    .select('id, full_name, email, role, access_status, phone, streak_count, last_login_date, created_at, enrolled_program_id, batch_id, batches!batch_id(name)')
    .order('created_at', { ascending: false })

  const students = (studentsRaw ?? []) as Record<string, unknown>[]

  const { data: batchesRaw } = await admin
    .from('batches').select('id, name, batch_type').in('status',['active','upcoming']).order('name')
  const batches = (batchesRaw ?? []) as { id: string; name: string; batch_type: string }[]

  // Module progress per student
  const { data: progressRaw } = await admin
    .from('module_progress').select('student_id, status').eq('status', 'completed')
  const progressMap: Record<string, number> = {}
  for (const p of (progressRaw ?? []) as { student_id: string }[])
    progressMap[p.student_id] = (progressMap[p.student_id] ?? 0) + 1

  // Test attempts per student
  const { data: attemptsRaw } = await admin
    .from('test_attempts').select('student_id, score_percent')
  const testMap: Record<string, { count: number; total: number }> = {}
  for (const a of (attemptsRaw ?? []) as { student_id: string; score_percent: number }[]) {
    if (!testMap[a.student_id]) testMap[a.student_id] = { count: 0, total: 0 }
    testMap[a.student_id].count++
    testMap[a.student_id].total += a.score_percent ?? 0
  }

  type EnrichedStudent = Record<string,unknown>
  const enriched: EnrichedStudent[] = students.map(s => ({
    ...s,
    modules_done:     progressMap[s.id as string] ?? 0,
    progress_percent: Math.round(((progressMap[s.id as string] ?? 0) / 24) * 100),
    tests_taken:      testMap[s.id as string]?.count ?? 0,
    avg_score:        testMap[s.id as string]
      ? Math.round(testMap[s.id as string]!.total / testMap[s.id as string]!.count)
      : null,
  }))

  const roleColors: Record<string, string> = {
    student:'var(--cyan)', teacher:'#a78bfa', parent:'#93c5fd', admin:'var(--green)',
  }
  const statusColors: Record<string, string> = {
    active:'var(--green)', pending_payment:'var(--amber)', restricted:'var(--red)',
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="All Users" subtitle={`${students.length} accounts registered`}/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Tests</th>
                    <th>Streak</th>
                    <th>Last Login</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((s, i) => (
                    <tr key={s.id as string} style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.015)' }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <div style={{
                            width:'32px', height:'32px', borderRadius:'50%', flexShrink:0,
                            background:'linear-gradient(135deg,#00c8f8,#7030d0)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'11px', color:'#fff',
                          }}>
                            {String(s.full_name??'?').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{fontWeight:500,fontSize:'13px'}}>{String(s.full_name??'—')}</div>
                            <div style={{fontSize:'11px',color:'var(--muted)'}}>{String(s.email??'')}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding:'3px 10px', borderRadius:'20px', fontSize:'10px', fontWeight:700,
                          background:`${roleColors[s.role as string]??'var(--cyan)'}18`,
                          color: roleColors[s.role as string]??'var(--cyan)',
                        }}>
                          {String(s.role??'student').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding:'3px 10px', borderRadius:'20px', fontSize:'10px', fontWeight:700,
                          background:`${statusColors[s.access_status as string]??'var(--muted)'}18`,
                          color: statusColors[s.access_status as string]??'var(--muted)',
                        }}>
                          {s.access_status==='pending_payment'?'PENDING':String(s.access_status??'').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{minWidth:'80px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                            <span style={{fontSize:'10px',color:'var(--muted)'}}>{s.modules_done as number}/24</span>
                            <span style={{fontSize:'10px',color:'var(--cyan)'}}>{s.progress_percent as number}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{width:`${s.progress_percent as number}%`}}/>
                          </div>
                        </div>
                      </td>
                      <td style={{textAlign:'center'}}>
                        <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'14px'}}>{s.tests_taken as number}</div>
                        {(s.avg_score as number|null)!==null&&<div style={{fontSize:'10px',color:'var(--muted)'}}>avg {s.avg_score as number}%</div>}
                      </td>
                      <td>
                        <span style={{fontSize:'13px'}}>🔥 {s.streak_count as number ?? 0}</span>
                      </td>
                      <td style={{fontSize:'11px',color:'var(--muted)',whiteSpace:'nowrap'}}>
                        {s.last_login_date?new Date(s.last_login_date as string).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'Never'}
                      </td>
                      <td style={{fontSize:'11px',color:'var(--muted)',whiteSpace:'nowrap'}}>
                        {s.created_at?new Date(s.created_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}):'—'}
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
