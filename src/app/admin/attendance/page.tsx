import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import AttendanceClient from './AttendanceClient'
import type { Profile } from '@/types/database'

export default async function AdminAttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile || !['admin','teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch all live sessions with attendance summary
  const { data: sessions } = await admin
    .from('live_sessions')
    .select('id, title, scheduled_at, duration_minutes, is_completed, is_live, host_id')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  const sessionList = (sessions ?? []) as Record<string, unknown>[]

  // For each session, get attendance counts
  const sessionIds = sessionList.map(s => s.id as string)
  const { data: allAttendance } = await admin
    .from('attendance_records')
    .select('session_id, status, student_id')
    .in('session_id', sessionIds.length > 0 ? sessionIds : ['none'])

  const attendanceMap: Record<string, { present: number; partial: number; absent: number; total: number }> = {}
  for (const rec of (allAttendance ?? []) as Record<string, unknown>[]) {
    const sid = rec.session_id as string
    if (!attendanceMap[sid]) attendanceMap[sid] = { present:0, partial:0, absent:0, total:0 }
    attendanceMap[sid].total++
    if (rec.status === 'present') attendanceMap[sid].present++
    else if (rec.status === 'partial') attendanceMap[sid].partial++
    else attendanceMap[sid].absent++
  }

  // Total enrolled students
  const { count: totalStudents } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .eq('access_status', 'active')

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Attendance Management" subtitle="Auto-recorded on join/leave · Export to CSV"/>

        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          {/* Info banner */}
          <div className="banner banner-info" style={{ marginBottom:'24px' }}>
            <span style={{ fontSize:'18px', flexShrink:0 }}>🤖</span>
            <div style={{ fontSize:'13px' }}>
              <strong style={{ color:'#fff' }}>Automatic attendance:</strong> When a student joins a live class, their
              <strong style={{ color:'#93c5fd' }}> join time</strong> is recorded. When they leave,
              the <strong style={{ color:'#93c5fd' }}>leave time and total duration</strong> are saved.
              Students attending &lt;50% of duration are marked <strong>Partial</strong>.
              Admin and teachers can manually override any record.
            </div>
          </div>

          {/* Sessions list */}
          <AttendanceClient
            sessions={sessionList}
            attendanceMap={attendanceMap}
            totalStudents={totalStudents ?? 0}
          />
        </div>
      </main>
    </div>
  )
}
