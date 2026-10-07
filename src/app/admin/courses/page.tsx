export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
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
    .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills, learning_outcomes, status, is_certificate_enabled, display_order, cover_image_path, price_inr, original_price_inr, track_slug')
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
    cover_image_path: string | null
    price_inr: number | null; original_price_inr: number | null; track_slug: string | null
  }[]

  return (
    <AuthShell profile={profile} title="Self-Paced Courses" subtitle="Create and manage the self-paced course library">
          <CoursesManagerClient courses={courses} moduleCounts={moduleCounts}/>
    </AuthShell>
  )
}
