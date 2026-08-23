export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CourseEditorClient from './CourseEditorClient'
import type { Profile } from '@/types/database'

export default async function AdminCourseEditorPage({
  params,
}: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: courseRow } = await admin.from('courses').select('id, title, slug, status').eq('id', courseId).maybeSingle()
  if (!courseRow) notFound()
  const course = courseRow as { id: string; title: string; slug: string; status: string }

  const { data: modulesRaw } = await admin
    .from('course_modules').select('id, title, module_number').eq('course_id', courseId).order('module_number')
  const modules = (modulesRaw ?? []) as { id: string; title: string; module_number: number }[]

  const moduleIds = modules.map(m => m.id)
  const { data: lessonsRaw } = moduleIds.length > 0 ? await admin
    .from('course_lessons')
    .select('id, module_id, title, lesson_number, estimated_duration_minutes, is_required')
    .in('module_id', moduleIds).order('lesson_number') : { data: [] }
  const lessons = (lessonsRaw ?? []) as {
    id: string; module_id: string; title: string; lesson_number: number
    estimated_duration_minutes: number; is_required: boolean
  }[]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title={course.title} subtitle="Modules & lessons"/>
        <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <CourseEditorClient course={course} modules={modules} lessons={lessons}/>
        </div>
      </main>
    </div>
  )
}
