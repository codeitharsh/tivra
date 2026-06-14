import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = p as Profile | null

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

  const medals = ['🥇','🥈','🥉']

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Leaderboard" subtitle="Top scores across all weekly tests"/>
        <div style={{ padding:'28px', maxWidth:'700px' }}>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px' }}>
                Weekly Test Rankings
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
                    background: isMe ? 'rgba(0,200,248,0.06)' : 'transparent',
                  }}>
                    <div style={{
                      fontFamily:'Syne,sans-serif', fontWeight:800,
                      fontSize:'20px', width:'32px', textAlign:'center',
                      color: i === 0 ? 'var(--amber)' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c3f' : 'var(--muted)',
                    }}>
                      {medals[i] ?? `#${i+1}`}
                    </div>
                    <div style={{
                      width:'36px', height:'36px', borderRadius:'50%', flexShrink:0,
                      background:'linear-gradient(135deg,#00c8f8,#7030d0)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'12px', color:'#fff',
                    }}>
                      {entry.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'14px', fontWeight:500, color: isMe ? 'var(--cyan)' : '#fff' }}>
                        {entry.name}{isMe && <span style={{ fontSize:'11px', color:'var(--cyan)', marginLeft:'6px' }}>(You)</span>}
                      </div>
                      <div style={{ fontSize:'11px', color:'var(--muted)' }}>{entry.tests} test{entry.tests !== 1 ? 's' : ''} taken</div>
                    </div>
                    <div style={{
                      fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'20px',
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
