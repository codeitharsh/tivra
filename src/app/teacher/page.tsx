export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import type { Profile } from '@/types/database'

export default async function TeacherHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin','teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Teacher-specific stats only — no student progress
  const [
    { count: totalStudents },
    { count: openDoubts },
    { data: myModulesRaw },
    { data: upcomingSessions },
  ] = await Promise.all([
    admin.from('profiles').select('*',{count:'exact',head:true})
      .eq('role','student').eq('access_status','active'),
    admin.from('doubts').select('*',{count:'exact',head:true}).eq('is_resolved',false),
    // Modules assigned to this teacher
    admin.from('modules').select('id, title, module_number, notes_url, is_unlocked, phases!phase_id(title, phase_number)')
      .eq('assigned_teacher_id', user.id).order('module_number'),
    admin.from('live_sessions').select('id, title, scheduled_at, is_live, batch_id, batches!batch_id(name)')
      .eq('is_completed', false).order('scheduled_at').limit(3),
  ])

  const myModules = (myModulesRaw   ?? []) as Record<string, unknown>[]
  const sessions  = (upcomingSessions ?? []) as Record<string, unknown>[]
  const notesUploaded = myModules.filter(m => m.notes_url).length

  // Recent unanswered doubts
  const { data: doubtsRaw } = await admin
    .from('doubts')
    .select('id, question_text, created_at, modules!module_id(title)')
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
    .limit(5)
  const doubts = (doubtsRaw ?? []) as Record<string, unknown>[]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar
          title={`Welcome, ${profile.full_name?.split(' ')[0] ?? 'Teacher'}`}
          subtitle="Your teaching dashboard"
        />
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          {/* Stats — teacher-relevant only */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'28px' }}>
            {[
              { icon:'👥', label:'Active Students', value: totalStudents ?? 0, color:'var(--cyan)'  },
              { icon:'📄', label:'My Modules',      value: myModules.length,   color:'var(--teal)'  },
              { icon:'📤', label:'Notes Uploaded',  value: `${notesUploaded}/${myModules.length}`, color:'var(--green)' },
              { icon:'💬', label:'Open Doubts',     value: openDoubts ?? 0,    color:'var(--amber)' },
            ].map(s => (
              <div key={s.label} className="card card-accent-top" style={{ padding:'16px 20px' }}>
                <div style={{ fontSize:'22px', marginBottom:'8px' }}>{s.icon}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'26px',
                  color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', marginBottom:'24px' }}>

            {/* Assigned modules */}
            <div className="card" style={{ padding:'20px' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px',
                marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>My Assigned Modules</span>
                <Link href="/teacher/content" style={{ fontSize:'12px', color:'var(--teal)', textDecoration:'none' }}>
                  Upload notes →
                </Link>
              </div>
              {myModules.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'var(--muted)', fontSize:'13px' }}>
                  <div style={{ fontSize:'28px', marginBottom:'8px' }}>📚</div>
                  No modules assigned yet.
                  <br/>Ask your admin to assign modules to you.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'280px', overflowY:'auto' }}>
                  {myModules.map(m => {
                    const ph = m.phases as Record<string,unknown>|null
                    return (
                      <div key={m.id as string} style={{
                        display:'flex', alignItems:'center', gap:'10px',
                        padding:'10px 12px', borderRadius:'8px',
                        background:'rgba(255,255,255,0.03)',
                        border:`1px solid ${m.notes_url ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                      }}>
                        <div style={{
                          width:'26px', height:'26px', borderRadius:'6px', flexShrink:0,
                          background: m.notes_url ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'12px',
                        }}>
                          {m.notes_url ? '✓' : `${String(m.module_number)}`}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'13px', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {String(m.title ?? '')}
                          </div>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                            Phase {String(ph?.phase_number ?? '')}
                            {m.notes_url
                              ? <span style={{ color:'var(--green)', marginLeft:'8px' }}>✓ Notes uploaded</span>
                              : <span style={{ color:'var(--amber)', marginLeft:'8px' }}>⚠ No notes</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px', marginBottom:'4px' }}>
                Quick Actions
              </div>
              {[
                { href:'/teacher/content',    icon:'📄', label:'Upload Notes',    desc:'Add or replace PDF notes' },
                { href:'/teacher/live',       icon:'🎥', label:'Schedule Class',  desc:'Create a new live session' },
                { href:'/teacher/doubts',     icon:'💬', label:'Answer Doubts',   desc:`${doubts.length} unanswered` },
                { href:'/teacher/curriculum', icon:'📚', label:'Edit Curriculum', desc:'Add/rename modules' },
                { href:'/teacher/tests',      icon:'📋', label:'Create Tests',    desc:'Build weekly tests' },
                { href:'/teacher/attendance', icon:'✅', label:'Attendance',      desc:'View session records' },
              ].map(a => (
                <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                  <div className="card" style={{ display:'flex', alignItems:'center', gap:'12px',
                    padding:'12px 16px', cursor:'pointer' }}>
                    <div style={{ fontSize:'20px', flexShrink:0 }}>{a.icon}</div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'13px', color:'#fff', marginBottom:'1px' }}>{a.label}</div>
                      <div style={{ fontSize:'11px', color:'var(--muted)' }}>{a.desc}</div>
                    </div>
                    <div style={{ marginLeft:'auto', color:'var(--muted)' }}>›</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Unanswered doubts */}
          {doubts.length > 0 && (
            <div className="card">
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px',
                marginBottom:'14px', display:'flex', justifyContent:'space-between' }}>
                <span>Unanswered Doubts ({doubts.length})</span>
                <Link href="/teacher/doubts" style={{ fontSize:'12px', color:'var(--teal)', textDecoration:'none' }}>
                  Answer all →
                </Link>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {doubts.map(d => {
                  const mod = d.modules as Record<string,unknown>|null
                  return (
                    <Link key={d.id as string} href="/teacher/doubts" style={{ textDecoration:'none' }}>
                      <div className="card" style={{ padding:'12px 16px', cursor:'pointer',
                        borderLeft:'2px solid var(--amber)' }}>
                        <div style={{ fontSize:'13px', marginBottom:'4px', lineHeight:1.4 }}>
                          {String(d.question_text ?? '').slice(0,90)}{String(d.question_text ?? '').length > 90 ? '…' : ''}
                        </div>
                        <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                          {mod ? `Module: ${String(mod.title ?? '')}` : 'General'}
                          {' · '}{new Date(d.created_at as string).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
          {/* Upcoming live sessions — this data was previously fetched
              and then silently dropped (no widget rendered it at all,
              triggering an unused-variable lint warning). Wired up here
              instead of just deleting the query, since a 3-session
              upcoming-classes preview is a reasonable, low-risk addition
              consistent with the My Modules / Unanswered Doubts widgets
              already on this page. */}
          {sessions.length > 0 && (
            <div className="card">
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px',
                marginBottom:'14px', display:'flex', justifyContent:'space-between' }}>
                <span>Upcoming Live Sessions</span>
                <Link href="/teacher/live" style={{ fontSize:'12px', color:'var(--teal)', textDecoration:'none' }}>
                  Manage all →
                </Link>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {sessions.map(s => {
                  const batch  = s.batches as Record<string,unknown>|null
                  const isLive = s.is_live as boolean
                  return (
                    <Link key={s.id as string} href="/teacher/live" style={{ textDecoration:'none' }}>
                      <div className="card" style={{ padding:'12px 16px', cursor:'pointer',
                        borderLeft: `2px solid ${isLive ? 'var(--green)' : 'var(--amber)'}` }}>
                        <div style={{ fontSize:'13px', marginBottom:'4px', fontWeight:500,
                          display:'flex', alignItems:'center', gap:'8px' }}>
                          {String(s.title ?? '')}
                          {isLive && (
                            <span style={{ color:'var(--green)', fontWeight:600, fontSize:'11px' }}>● LIVE NOW</span>
                          )}
                        </div>
                        <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                          {batch ? `${String(batch.name ?? '')} · ` : ''}
                          {new Date(s.scheduled_at as string).toLocaleString('en-IN', {
                            day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
                          })}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
