export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { requireActiveStudent } from '@/lib/access-gate'
import type { Profile } from '@/types/database'
import LockedFeature from '@/components/LockedFeature'
import { Medal } from 'lucide-react'

export default async function LeaderboardPage() {
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
          <Topbar title="Leaderboard"/>
          <LockedFeature feature="Leaderboard" description="See your ranking among peers — available after enrolment."/>
        </main>
      </div>
    )
  }

  const admin = createAdminClient()

  // Fetch top students by test average
  const { data: attemptsRaw } = await admin
    .from('test_attempts')
    .select('student_id, score_percent')

  const attempts = (attemptsRaw ?? []) as { student_id: string; score_percent: number }[]

  // Calculate average per student
  const map: Record<string, { total: number; count: number }> = {}
  for (const a of attempts) {
    if (!map[a.student_id]) map[a.student_id] = { total: 0, count: 0 }
    map[a.student_id].total += a.score_percent ?? 0
    map[a.student_id].count++
  }

  // Fetch names
  const ids = Object.keys(map)
  const { data: profilesRaw } = ids.length > 0
    ? await admin.from('profiles').select('id, full_name').in('id', ids)
    : { data: [] }

  const nameMap = new Map(
    (profilesRaw as { id: string; full_name: string }[] ?? []).map(p => [p.id, p.full_name])
  )

  const ranked = Object.entries(map)
    .map(([id, v]) => ({
      id,
      name: nameMap.get(id) ?? 'Anonymous',
      avg: Math.round(v.total / v.count),
      tests: v.count,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)

  const medalColors = ['var(--amber)', '#b8bfc9', '#c9905b']

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Leaderboard" subtitle="Top scores across all weekly tests"/>
        <div style={{ padding:'28px', maxWidth:'700px' }}>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px' }}>
                Weekly test rankings
              </div>
              <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>
                Based on average score across all tests taken
              </div>
            </div>

            {ranked.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'var(--muted)', fontSize:'14px' }}>
                No test scores yet. Take a weekly test to appear here.
              </div>
            ) : (
              ranked.map((entry, i) => {
                const isMe = entry.id === user.id
                return (
                  <div key={entry.id} style={{
                    display:'flex', alignItems:'center', gap:'14px',
                    padding:'14px 20px',
                    borderBottom: i < ranked.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isMe ? 'var(--accent-dim)' : 'transparent',
                  }}>
                    <div style={{
                      width:'32px', display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'16px',
                      color: i < 3 ? medalColors[i] : 'var(--muted)',
                    }}>
                      {i < 3 ? <Medal size={18}/> : `#${i+1}`}
                    </div>
                    <div style={{
                      width:'36px', height:'36px', borderRadius:'6px', flexShrink:0,
                      background:'var(--card2)', border: '1px solid var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'12px', color:'var(--text)',
                    }}>
                      {entry.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'14px', fontWeight:500, color: isMe ? 'var(--accent-2)' : 'var(--text)' }}>
                        {entry.name}{isMe && <span style={{ fontSize:'11px', color:'var(--accent-2)', marginLeft:'6px' }}>(You)</span>}
                      </div>
                      <div style={{ fontSize:'11px', color:'var(--muted)' }}>{entry.tests} test{entry.tests !== 1 ? 's' : ''} taken</div>
                    </div>
                    <div style={{
                      fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'18px',
                      color: entry.avg >= 75 ? 'var(--green)' : entry.avg >= 50 ? 'var(--amber)' : 'var(--red)',
                    }}>
                      {entry.avg}%
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
