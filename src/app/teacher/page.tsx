export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import type { Profile } from '@/types/database'
import {
  Users, FileText, Upload, MessageCircle, BookOpen, Video,
  ClipboardList, CheckSquare, ChevronRight, Check, Radio,
} from 'lucide-react'

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
    { data: allModulesRaw },
    { data: upcomingSessions },
  ] = await Promise.all([
    admin.from('profiles').select('*',{count:'exact',head:true})
      .eq('role','student').eq('access_status','active'),
    admin.from('doubts').select('*',{count:'exact',head:true}).eq('is_resolved',false),
    // All modules across every programme — there is no real per-teacher
    // module-assignment feature anywhere in the app (assigned_teacher_id
    // is never written by any admin UI or API route), so scoping this to
    // .eq('assigned_teacher_id', user.id) made this permanently empty for
    // every teacher: "Notes uploaded" always showed 0/0 regardless of how
    // many notes actually existed, since real uploads (teacher/content)
    // don't use or require that column at all.
    admin.from('modules').select('id, title, module_number, notes_url, is_unlocked, phases!phase_id(title, phase_number)')
      .order('phase_id').order('module_number'),
    admin.from('live_sessions').select('id, title, scheduled_at, is_live, batch_id, batches!batch_id(name)')
      .eq('is_completed', false).order('scheduled_at').limit(3),
  ])

  const allModules = (allModulesRaw   ?? []) as Record<string, unknown>[]
  const sessions    = (upcomingSessions ?? []) as Record<string, unknown>[]
  const notesUploaded = allModules.filter(m => m.notes_url).length

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
        <div style={{ padding:'28px', maxWidth:'1100px', margin:'0 auto', width:'100%' }}>

          {/* Stats — teacher-relevant only */}
          <div className="r-grid-4" style={{ marginBottom:'28px' }}>
            {[
              { Icon:Users,    label:'Active students', value: totalStudents ?? 0, color:'var(--accent-2)' },
              { Icon:FileText, label:'Total modules',   value: allModules.length,  color:'var(--accent)'  },
              { Icon:Upload,   label:'Notes uploaded',  value: `${notesUploaded}/${allModules.length}`, color:'var(--green)' },
              { Icon:MessageCircle, label:'Open doubts', value: openDoubts ?? 0,    color:'var(--amber)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                  <div className="stat-label" style={{ marginBottom:0 }}>{s.label}</div>
                  <s.Icon size={14} color="var(--muted2)"/>
                </div>
                <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="r-split" style={{ marginBottom:'20px' }}>

            {/* Assigned modules */}
            <div className="card" style={{ padding:'20px' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px',
                marginBottom:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>Course modules</span>
                <Link href="/teacher/content" style={{ fontSize:'12px', color:'var(--accent-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
                  UPLOAD NOTES →
                </Link>
              </div>
              {allModules.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'var(--muted)', fontSize:'13px' }}>
                  <BookOpen size={26} color="var(--muted2)" style={{ marginBottom:'8px' }}/>
                  <div>No modules found.</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'280px', overflowY:'auto' }}>
                  {allModules.map(m => {
                    const ph = m.phases as Record<string,unknown>|null
                    return (
                      <div key={m.id as string} style={{
                        display:'flex', alignItems:'center', gap:'10px',
                        padding:'10px 12px', borderRadius:'var(--radius-sm)',
                        background:'var(--card2)',
                        border:`1px solid ${m.notes_url ? 'rgba(74,222,128,0.2)' : 'var(--border)'}`,
                      }}>
                        <div style={{
                          width:'26px', height:'26px', borderRadius:'6px', flexShrink:0,
                          background: m.notes_url ? 'var(--green-dim)' : 'rgba(255,255,255,0.06)',
                          color: m.notes_url ? 'var(--green)' : 'var(--muted)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'12px', fontFamily:'var(--font-mono)',
                        }}>
                          {m.notes_url ? <Check size={13}/> : String(m.module_number)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'13px', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {String(m.title ?? '')}
                          </div>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                            Phase {String(ph?.phase_number ?? '')}
                            {m.notes_url
                              ? <span style={{ color:'var(--green)', marginLeft:'8px' }}>Notes uploaded</span>
                              : <span style={{ color:'var(--amber)', marginLeft:'8px' }}>No notes</span>}
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
              <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px', marginBottom:'4px' }}>
                Quick actions
              </div>
              {[
                { href:'/teacher/content',    Icon:Upload,        label:'Upload notes',    desc:'Add or replace PDF notes' },
                { href:'/teacher/live',       Icon:Video,         label:'Schedule class',  desc:'Create a new live session' },
                { href:'/teacher/doubts',     Icon:MessageCircle, label:'Answer doubts',   desc:`${doubts.length} unanswered` },
                { href:'/teacher/curriculum', Icon:BookOpen,      label:'Edit curriculum', desc:'Add/rename modules' },
                { href:'/teacher/tests',      Icon:ClipboardList, label:'Create tests',    desc:'Build weekly tests' },
                { href:'/teacher/attendance', Icon:CheckSquare,   label:'Attendance',      desc:'View session records' },
              ].map(a => (
                <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                  <div className="card" style={{ display:'flex', alignItems:'center', gap:'12px',
                    padding:'12px 16px', cursor:'pointer' }}>
                    <div style={{
                      width:'32px', height:'32px', borderRadius:'6px', flexShrink:0,
                      background:'var(--accent-dim)', color:'var(--accent-2)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <a.Icon size={15}/>
                    </div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'13px', color:'var(--text)', marginBottom:'1px' }}>{a.label}</div>
                      <div style={{ fontSize:'11px', color:'var(--muted)' }}>{a.desc}</div>
                    </div>
                    <ChevronRight size={15} style={{ marginLeft:'auto', color:'var(--muted)', flexShrink:0 }}/>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Unanswered doubts */}
          {doubts.length > 0 && (
            <div className="card" style={{ marginBottom:'20px' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px',
                marginBottom:'14px', display:'flex', justifyContent:'space-between' }}>
                <span>Unanswered doubts ({doubts.length})</span>
                <Link href="/teacher/doubts" style={{ fontSize:'12px', color:'var(--accent-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
                  ANSWER ALL →
                </Link>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {doubts.map(d => {
                  const mod = d.modules as Record<string,unknown>|null
                  return (
                    <Link key={d.id as string} href="/teacher/doubts" style={{ textDecoration:'none' }}>
                      <div style={{ padding:'12px 16px', cursor:'pointer', borderRadius:'var(--radius-sm)',
                        background:'var(--card2)', borderLeft:'2px solid var(--amber)' }}>
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
              <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px',
                marginBottom:'14px', display:'flex', justifyContent:'space-between' }}>
                <span>Upcoming live sessions</span>
                <Link href="/teacher/live" style={{ fontSize:'12px', color:'var(--accent-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
                  MANAGE ALL →
                </Link>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {sessions.map(s => {
                  const batch  = s.batches as Record<string,unknown>|null
                  const isLive = s.is_live as boolean
                  return (
                    <Link key={s.id as string} href="/teacher/live" style={{ textDecoration:'none' }}>
                      <div style={{ padding:'12px 16px', cursor:'pointer', borderRadius:'var(--radius-sm)',
                        background:'var(--card2)', borderLeft: `2px solid ${isLive ? 'var(--green)' : 'var(--amber)'}` }}>
                        <div style={{ fontSize:'13px', marginBottom:'4px', fontWeight:500,
                          display:'flex', alignItems:'center', gap:'8px' }}>
                          {String(s.title ?? '')}
                          {isLive && (
                            <span style={{ color:'var(--green)', fontWeight:600, fontSize:'11px', display:'inline-flex', alignItems:'center', gap:'4px', fontFamily:'var(--font-mono)' }}>
                              <Radio size={11}/> LIVE NOW
                            </span>
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
