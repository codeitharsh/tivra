export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import QuizManagerClient from './QuizManagerClient'
import type { Profile } from '@/types/database'

export default async function AdminCourseQuizzesPage({
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
  const { data: courseRow } = await admin.from('courses').select('id, title, slug').eq('id', courseId).maybeSingle()
  if (!courseRow) notFound()
  const course = courseRow as { id: string; title: string; slug: string }

  const { data: modulesRaw } = await admin
    .from('course_modules').select('id, title, module_number').eq('course_id', courseId).order('module_number')
  const modules = (modulesRaw ?? []) as { id: string; title: string; module_number: number }[]

  const { data: quizzesRaw } = await admin
    .from('course_quizzes')
    .select('id, title, quiz_type, module_id, passing_percent')
    .eq('course_id', courseId)
  const quizzes = (quizzesRaw ?? []) as {
    id: string; title: string; quiz_type: 'module_test' | 'final_assessment'
    module_id: string | null; passing_percent: number
  }[]

  const quizIds = quizzes.map(q => q.id)
  const { data: questionsRaw } = quizIds.length > 0 ? await admin
    .from('course_quiz_questions')
    .select('id, quiz_id, question_text, options, correct_answer, explanation, order_num')
    .in('quiz_id', quizIds)
    .order('order_num') : { data: [] }
  const questions = (questionsRaw ?? []) as {
    id: string; quiz_id: string; question_text: string; options: string[]
    correct_answer: string; explanation: string | null; order_num: number
  }[]

  return (
    <AuthShell profile={profile} title={course.title} subtitle="Quizzes — module tests & final assessment" maxWidth={900}>
      <QuizManagerClient course={course} modules={modules} quizzes={quizzes} questions={questions}/>
    </AuthShell>
  )
}
