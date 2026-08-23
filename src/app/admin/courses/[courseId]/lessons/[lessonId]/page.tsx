export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import LessonBlockEditorClient from './LessonBlockEditorClient'
import type { Profile } from '@/types/database'
import type { CourseBlock } from '@/types/course'

export default async function AdminLessonEditorPage({
  params,
}: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: courseRow } = await admin.from('courses').select('id, title').eq('id', courseId).maybeSingle()
  if (!courseRow) notFound()
  const course = courseRow as { id: string; title: string }

  const { data: lessonRow } = await admin
    .from('course_lessons')
    .select('id, module_id, title, content, course_modules!module_id(course_id)')
    .eq('id', lessonId)
    .maybeSingle()
  if (!lessonRow) notFound()

  type ModuleJoin = { course_id: string } | { course_id: string }[] | null
  const moduleJoinRaw = (lessonRow as { course_modules: ModuleJoin }).course_modules
  const moduleJoin = Array.isArray(moduleJoinRaw) ? moduleJoinRaw[0] : moduleJoinRaw
  if (!moduleJoin || moduleJoin.course_id !== courseId) notFound()

  const lesson = lessonRow as { id: string; module_id: string; title: string; content: CourseBlock[] }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title={lesson.title} subtitle={`${course.title} — lesson content`}/>
        <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <LessonBlockEditorClient courseId={courseId} lessonId={lesson.id} initialContent={lesson.content ?? []}/>
        </div>
      </main>
    </div>
  )
}
