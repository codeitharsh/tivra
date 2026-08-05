export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { requireActiveStudent } from '@/lib/access-gate'
import type { Profile } from '@/types/database'
import LockedFeature from '@/components/LockedFeature'
import { Video, Radio, PlayCircle, ArrowRight } from 'lucide-react'

export default async function LivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null
  if (!profile) redirect('/login')

  // For unenrolled students, show a locked screen rather than redirecting —
  // brief says these features are visible but locked, not hidden entirely.
  const isEnrolled = profile.access_status === 'active'
  if (!isEnrolled) {
    return (
      <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
        <Sidebar profile={profile}/>
        <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
          <Topbar title="Live Classes"/>
          <LockedFeature feature="Live Classes" description="Join live instructor-led sessions — available after enrolment."/>
        </main>
      </div>
    )
  }

  const admin = createAdminClient()

  const { data: sessionsRaw } = await admin
    .from('live_sessions')
    .select('*, phases!phase_id(title, phase_number)')
    .order('scheduled_at', { ascending: false })
    .limit(20)

  const sessions = (sessionsRaw ?? []) as Record<string, unknown>[]
  const now = new Date()

  function getStatus(s: Record<string, unknown>) {
    if (s.is_live) return 'live'
    if (s.is_completed) return 'ended'
    const scheduled = new Date(s.scheduled_at as string)
    const minsUntil = (scheduled.getTime() - now.getTime()) / 60000
    if (minsUntil <= 15 && minsUntil > 0) return 'starting'
    if (minsUntil > 0) return 'upcoming'
    return 'ended'
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    live:     { label:'Live now',       color:'var(--green)', bg:'var(--green-dim)'      },
    starting: { label:'Starting soon',  color:'var(--amber)', bg:'var(--amber-dim)'      },
    upcoming: { label:'Upcoming',       color:'var(--muted)', bg:'rgba(255,255,255,0.06)'},
    ended:    { label:'Ended',          color:'var(--muted)', bg:'rgba(255,255,255,0.04)'},
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Live Classes" subtitle="Join button appears 15 minutes before class starts"/>
        <div style={{ padding:'28px', maxWidth:'800px' }}>

          {sessions.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'48px', color:'var(--muted)' }}>
              <Video size={28} color="var(--muted2)" style={{ marginBottom:'12px' }}/>
              <div style={{ fontSize:'14px' }}>No live sessions scheduled yet.</div>
              <div style={{ fontSize:'13px', marginTop:'6px' }}>Your teacher will schedule sessions soon.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {sessions.map(rawS => { const session = rawS as Record<string, string|number|boolean|null>;
                const st  = getStatus(session)
                const cfg = statusConfig[st]
                const scheduled = new Date(session.scheduled_at as string)
                const phase = session.phases as Record<string,unknown> | null
                const canJoin = (st === 'live' || st === 'starting') && session.join_url

                return (
                  <div key={session.id as string} className="card" style={{
                    display:'flex', alignItems:'center', gap:'16px', padding:'18px 20px',
                    opacity: st === 'ended' ? 0.65 : 1,
                  }}>
                    {/* Status icon */}
                    <div style={{
                      width:'32px', height:'32px', borderRadius:'6px', flexShrink:0,
                      background: cfg.bg, color: cfg.color,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {st === 'live' ? <Radio size={15}/> : <Video size={15}/>}
                    </div>

                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'14px', marginBottom:'3px' }}>
                        {String(session.title ?? '')}
                      </div>
                      <div style={{ fontSize:'12px', color:'var(--muted)' }}>
                        {phase ? `Phase ${phase.phase_number}: ${phase.title}` : ''}{' · '}
                        {scheduled.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                        {' at '}
                        {scheduled.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                        {' · '}
                        {String(session.duration_minutes ?? 60)} min
                      </div>
                    </div>

                    <span style={{
                      padding:'3px 10px', borderRadius:'var(--radius-pill)', fontSize:'11px', fontWeight:600,
                      background: cfg.bg, color: cfg.color, fontFamily:'var(--font-mono)',
                    }}>{cfg.label}</span>

                    <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                      {canJoin && (
                        <a href={session.join_url as string} target="_blank" rel="noreferrer"
                          className="btn btn-primary" style={{ fontSize:'12px', padding:'7px 16px' }}>
                          Join <ArrowRight size={12}/>
                        </a>
                      )}
                      {session.recording_url && (
                        <a href={session.recording_url as string} target="_blank" rel="noreferrer"
                          className="btn btn-ghost" style={{ fontSize:'12px', padding:'7px 16px' }}>
                          <PlayCircle size={12}/> Recording
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
