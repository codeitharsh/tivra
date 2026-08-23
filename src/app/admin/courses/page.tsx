export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CoursesManagerClient from './CoursesManagerClient'
import type { Profile } from '@/types/database'

export default async function AdminCoursesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: coursesRaw } = await admin
    .from('courses')
    .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills, learning_outcomes, status, is_certificate_enabled, display_order')
    .order('display_order')

  const { data: moduleCountsRaw } = await admin.from('course_modules').select('course_id')
  const moduleCounts: Record<string, number> = {}
  for (const m of (moduleCountsRaw ?? []) as { course_id: string }[]) {
    moduleCounts[m.course_id] = (moduleCounts[m.course_id] ?? 0) + 1
  }

  const courses = (coursesRaw ?? []) as {
    id: string; slug: string; title: string; description: string | null
    difficulty: string; estimated_duration_minutes: number | null
    skills: string[]; learning_outcomes: string[]
    status: string; is_certificate_enabled: boolean; display_order: number
  }[]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title="Self-Paced Courses" subtitle="Create and manage the self-paced course library"/>
        <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          <CoursesManagerClient courses={courses} moduleCounts={moduleCounts}/>
        </div>
      </main>
    </div>
  )
}
