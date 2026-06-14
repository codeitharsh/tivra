import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/types/database'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  // ── Core counts ───────────────────────────────────────────
  const [
    { count: totalStudents },
    { count: activeStudents },
    { count: pendingStudents },
    { count: totalTests },
    { count: totalAttempts },
    { count: totalCerts },
    { count: totalDoubts },
    { count: resolvedDoubts },
    { count: totalSessions },
  ] = await Promise.all([
    admin.from('profiles').select('*',{count:'exact',head:true}).eq('role','student'),
    admin.from('profiles').select('*',{count:'exact',head:true}).eq('role','student').eq('access_status','active'),
    admin.from('profiles').select('*',{count:'exact',head:true}).eq('role','student').eq('access_status','pending_payment'),
    admin.from('weekly_tests').select('*',{count:'exact',head:true}),
    admin.from('test_attempts').select('*',{count:'exact',head:true}),
    admin.from('certificates').select('*',{count:'exact',head:true}).eq('is_revoked',false),
    admin.from('doubts').select('*',{count:'exact',head:true}),
    admin.from('doubts').select('*',{count:'exact',head:true}).eq('is_resolved',true),
    admin.from('live_sessions').select('*',{count:'exact',head:true}),
  ])

  // ── Test score distribution ───────────────────────────────
  const { data: allAttempts } = await admin
    .from('test_attempts').select('score_percent, student_id')
  const attempts = (allAttempts ?? []) as { score_percent: number; student_id: string }[]
  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.score_percent ?? 0), 0) / attempts.length)
    : 0
  const passRate = attempts.length > 0
    ? Math.round((attempts.filter(a => a.score_percent >= 75).length / attempts.length) * 100)
    : 0

  // Score buckets
  const buckets = [
    { label: '0–24%',   count: attempts.filter(a => a.score_percent < 25).length,                    color: 'var(--red)'  },
    { label: '25–49%',  count: attempts.filter(a => a.score_percent >= 25 && a.score_percent < 50).length, color: '#f97316' },
    { label: '50–74%',  count: attempts.filter(a => a.score_percent >= 50 && a.score_percent < 75).length, color: 'var(--amber)' },
    { label: '75–89%',  count: attempts.filter(a => a.score_percent >= 75 && a.score_percent < 90).length, color: 'var(--teal)'  },
    { label: '90–100%', count: attempts.filter(a => a.score_percent >= 90).length,                   color: 'var(--green)' },
  ]
  const maxBucket = Math.max(...buckets.map(b => b.count), 1)

  // ── Module completion ─────────────────────────────────────
  const { data: progressRaw } = await admin
    .from('module_progress')
    .select('module_id, status')
    .eq('status', 'completed')

  const modCompletionMap: Record<string, number> = {}
  for (const p of (progressRaw ?? []) as { module_id: string }[])
    modCompletionMap[p.module_id] = (modCompletionMap[p.module_id] ?? 0) + 1

  const totalCompletions = Object.values(modCompletionMap).reduce((a, b) => a + b, 0)

  // ── Assessment pass rate ──────────────────────────────────
  const { data: assessAttempts } = await admin
    .from('assessment_attempts').select('passed, score_percent')
  const assAttempts = (assessAttempts ?? []) as { passed: boolean; score_percent: number }[]
  const assessPassRate = assAttempts.length > 0
    ? Math.round((assAttempts.filter(a => a.passed).length / assAttempts.length) * 100)
    : 0

  // ── Recent signups (last 7 days) ──────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { count: recentSignups } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  // ── Top students by test score ────────────────────────────
  const studentScoreMap: Record<string, { total: number; count: number }> = {}
  for (const a of attempts) {
    if (!studentScoreMap[a.student_id]) studentScoreMap[a.student_id] = { total: 0, count: 0 }
    studentScoreMap[a.student_id].total += a.score_percent ?? 0
    studentScoreMap[a.student_id].count++
  }
  const topIds = Object.entries(studentScoreMap)
    .map(([id, v]) => ({ id, avg: Math.round(v.total / v.count), count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  const { data: topProfilesRaw } = topIds.length > 0
    ? await admin.from('profiles').select('id, full_name').in('id', topIds.map(t => t.id))
    : { data: [] }
  const topNameMap = new Map(
    (topProfilesRaw as { id: string; full_name: string }[] ?? []).map(p => [p.id, p.full_name])
  )
  const topStudents = topIds.map(t => ({ ...t, name: topNameMap.get(t.id) ?? 'Unknown' }))

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Analytics" subtitle="Platform-wide statistics and performance metrics"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          {/* ── Top stats ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'24px' }}>
            {[
              { label:'Total Students',    value:totalStudents??0,  color:'var(--cyan)',   sub:`${activeStudents??0} active · ${pendingStudents??0} pending` },
              { label:'New This Week',      value:recentSignups??0,  color:'#a78bfa',       sub:'Signups in last 7 days' },
              { label:'Certificates Issued',value:totalCerts??0,    color:'var(--green)',   sub:`${assessPassRate}% assessment pass rate` },
              { label:'Test Attempts',      value:totalAttempts??0,  color:'var(--amber)',   sub:`${avgScore}% average score` },
            ].map(s => (
              <div key={s.label} className="card card-accent-top" style={{ padding:'16px 20px' }}>
                <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase',
                  letterSpacing:'0.08em', marginBottom:'6px' }}>{s.label}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'30px',
                  color:s.color, lineHeight:1, marginBottom:'4px' }}>{s.value}</div>
                <div style={{ fontSize:'11px', color:'var(--muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', marginBottom:'20px' }}>

            {/* ── Test Score Distribution ── */}
            <div className="card" style={{ padding:'20px' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px', marginBottom:'20px' }}>
                Test Score Distribution
                <span style={{ fontFamily:'DM Sans,sans-serif', fontWeight:400, fontSize:'12px',
                  color:'var(--muted)', marginLeft:'10px' }}>
                  {attempts.length} total attempts · {passRate}% pass rate
                </span>
              </div>
              {buckets.map(b => (
                <div key={b.label} style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px',
                    fontSize:'12px' }}>
                    <span style={{ color:'var(--muted)' }}>{b.label}</span>
                    <span style={{ fontWeight:600, color:b.color }}>{b.count}</span>
                  </div>
                  <div className="progress-track">
                    <div style={{
                      height:'100%', borderRadius:'inherit',
                      width:`${(b.count / maxBucket) * 100}%`,
                      background:b.color,
                      transition:'width 0.6s ease',
                    }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Platform health ── */}
            <div className="card" style={{ padding:'20px' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px', marginBottom:'20px' }}>
                Platform Health
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                {[
                  {
                    label: 'Student Activation Rate',
                    pct:   totalStudents ? Math.round(((activeStudents??0) / (totalStudents??1)) * 100) : 0,
                    color: 'var(--cyan)',
                    note:  `${activeStudents??0} of ${totalStudents??0} students active`,
                  },
                  {
                    label: 'Doubt Resolution Rate',
                    pct:   totalDoubts ? Math.round(((resolvedDoubts??0) / (totalDoubts??1)) * 100) : 0,
                    color: 'var(--teal)',
                    note:  `${resolvedDoubts??0} of ${totalDoubts??0} doubts answered`,
                  },
                  {
                    label: 'Assessment Pass Rate',
                    pct:   assessPassRate,
                    color: assessPassRate >= 70 ? 'var(--green)' : assessPassRate >= 50 ? 'var(--amber)' : 'var(--red)',
                    note:  `${assAttempts.filter(a=>a.passed).length} of ${assAttempts.length} attempts passed`,
                  },
                  {
                    label: 'Average Test Score',
                    pct:   avgScore,
                    color: avgScore >= 75 ? 'var(--green)' : avgScore >= 50 ? 'var(--amber)' : 'var(--red)',
                    note:  `${avgScore}% across all ${attempts.length} test attempts`,
                  },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px', fontSize:'12px' }}>
                      <span>{s.label}</span>
                      <span style={{ fontWeight:700, color:s.color }}>{s.pct}%</span>
                    </div>
                    <div className="progress-track">
                      <div style={{
                        height:'100%', borderRadius:'inherit',
                        width:`${s.pct}%`, background:s.color, transition:'width 0.6s ease',
                      }}/>
                    </div>
                    <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'3px' }}>{s.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:'grid' }}>

            {/* ── Top students ── */}
            <div className="card" style={{ padding:'20px' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px', marginBottom:'16px' }}>
                Top Students (by avg test score)
              </div>
              {topStudents.length === 0 ? (
                <div style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'16px' }}>
                  No test attempts yet
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {topStudents.map((s, i) => (
                    <div key={s.id} style={{
                      display:'flex', alignItems:'center', gap:'12px',
                      padding:'10px 12px', borderRadius:'8px',
                      background:'rgba(255,255,255,0.03)',
                    }}>
                      <div style={{
                        fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'16px',
                        color: i===0?'var(--amber)':i===1?'#94a3b8':i===2?'#cd7c3f':'var(--muted)',
                        width:'28px', textAlign:'center',
                      }}>
                        {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'13px', fontWeight:500 }}>{s.name}</div>
                        <div style={{ fontSize:'11px', color:'var(--muted)' }}>{s.count} test{s.count!==1?'s':''} taken</div>
                      </div>
                      <div style={{
                        fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'18px',
                        color: s.avg >= 75 ? 'var(--green)' : s.avg >= 50 ? 'var(--amber)' : 'var(--red)',
                      }}>
                        {s.avg}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Summary numbers ── */}
            <div className="card" style={{ padding:'20px' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px', marginBottom:'16px' }}>
                Content Summary
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                {[
                  { label:'Weekly Tests Created',  value: totalTests??0 },
                  { label:'Total Test Attempts',   value: totalAttempts??0 },
                  { label:'Module Completions',    value: totalCompletions },
                  { label:'Certificates Issued',   value: totalCerts??0 },
                  { label:'Live Sessions',         value: totalSessions??0 },
                  { label:'Doubts Posted',         value: totalDoubts??0 },
                  { label:'Doubts Resolved',       value: resolvedDoubts??0 },
                ].map((s, i, arr) => (
                  <div key={s.label} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'12px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <span style={{ fontSize:'13px', color:'var(--muted)' }}>{s.label}</span>
                    <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'16px' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
