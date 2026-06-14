import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import LiveRoomClient from './LiveRoomClient'
import type { Profile } from '@/types/database'

export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  const { data: sessionData } = await admin
    .from('live_sessions')
    .select('*, phases!phase_id(title, phase_number), modules!module_id(title)')
    .eq('id', sessionId)
    .single()

  if (!sessionData) notFound()

  const session = sessionData as Record<string, unknown>

  // Get student's attendance record if any
  const { data: attendanceData } = await supabase
    .from('attendance_records')
    .select('joined_at, left_at, status, session_code')
    .eq('session_id', sessionId)
    .eq('student_id', user.id)
    .maybeSingle()

  const attendance = attendanceData as Record<string, unknown> | null

  // Check if session code verification is required
  const { data: controlData } = await admin
    .from('session_controls')
    .select('attendance_window_open, session_code')
    .eq('id', sessionId)
    .maybeSingle()

  const control = controlData as { attendance_window_open: boolean; session_code: string } | null

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
        <LiveRoomClient
          session={session}
          studentId={user.id}
          studentName={profile.full_name ?? 'Student'}
          existingAttendance={attendance}
          requiresCode={control?.attendance_window_open ?? false}
          sessionId={sessionId}
        />
      </main>
    </div>
  )
}
