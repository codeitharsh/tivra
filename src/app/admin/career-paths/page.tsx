export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import CareerPathsManagerClient from './CareerPathsManagerClient'
import type { Profile } from '@/types/database'

export default async function AdminCareerPathsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: pathsRaw } = await admin
    .from('career_paths')
    .select('id, slug, title, description, skills, price_inr, original_price_inr, status, display_order')
    .order('display_order')
  const careerPaths = (pathsRaw ?? []) as {
    id: string; slug: string; title: string; description: string | null
    skills: string[]; price_inr: number | null; original_price_inr: number | null
    status: string; display_order: number
  }[]

  const { data: linksRaw } = await admin
    .from('career_path_courses')
    .select('career_path_id, course_id, display_order')
    .order('display_order')
  const links = (linksRaw ?? []) as { career_path_id: string; course_id: string; display_order: number }[]

  const { data: coursesRaw } = await admin
    .from('courses').select('id, title, slug, status').order('title')
  const allCourses = (coursesRaw ?? []) as { id: string; title: string; slug: string; status: string }[]

  return (
    <AuthShell profile={profile} title="Career Paths" subtitle="Role-based course bundles — e.g. Data Analyst = Python + Excel + Power BI + SQL">
      <CareerPathsManagerClient careerPaths={careerPaths} links={links} allCourses={allCourses}/>
    </AuthShell>
  )
}
