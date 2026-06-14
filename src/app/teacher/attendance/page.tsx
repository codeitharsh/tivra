export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import AttendanceClient from '@/app/admin/attendance/AttendanceClient'
import type { Profile } from '@/types/database'

export default async function TeacherAttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin','teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: sessions } = await admin
    .from('live_sessions')
    .select('id, title, scheduled_at, duration_minutes, is_completed, is_live')
    .order('scheduled_at', { ascending: false })
    .limit(30)

  const sessionList = (sessions ?? []) as Record<string, unknown>[]
  const sessionIds  = sessionList.map(s => s.id as string)

  const { data: allAttendance } = sessionIds.length > 0
    ? await admin.from('attendance_records').select('session_id, status, student_id').in('session_id', sessionIds)
    : { data: [] }

  const attendanceMap: Record<string, { present:number; partial:number; absent:number; total:number }> = {}
  for (const rec of (allAttendance ?? []) as Record<string, unknown>[]) {
    const sid = rec.session_id as string
    if (!attendanceMap[sid]) attendanceMap[sid] = { present:0, partial:0, absent:0, total:0 }
    attendanceMap[sid].total++
    if (rec.status === 'present') attendanceMap[sid].present++
    else if (rec.status === 'partial') attendanceMap[sid].partial++
    else attendanceMap[sid].absent++
  }

  const { count: totalStudents } = await admin
    .from('profiles').select('*',{count:'exact',head:true})
    .eq('role','student').eq('access_status','active')

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Attendance" subtitle="Session attendance records · Export CSV"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
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
