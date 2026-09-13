export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import CourseQuizTaker from '@/components/course/CourseQuizTaker'
import { isQuizUnlocked } from '@/lib/course-progress'
import { isPaidCourse, hasPurchasedCourse } from '@/lib/course-access'
import { buildBreakdown, type QuestionBreakdownItem } from '@/lib/question-breakdown'
import type { Profile } from '@/types/database'

export default async function CourseQuizPage({
  params,
}: { params: Promise<{ slug: string; quizId: string }> }) {
  const { slug, quizId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const { data: courseRow } = await admin
    .from('courses')
    .select('id, slug, title, price_inr')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!courseRow) notFound()
  const course = courseRow as { id: string; slug: string; title: string; price_inr: number | null }

  // Same defense-in-depth as the lesson reader — a paid course's quiz
  // is only reachable once purchased.
  if (isPaidCourse(course.price_inr) && !(await hasPurchasedCourse(admin, user.id, course.id))) {
    redirect(`/courses/${course.slug}`)
  }

  const { data: quizRow } = await admin
    .from('course_quizzes')
    .select('id, course_id, title, passing_percent, module_id, quiz_type')
    .eq('id', quizId)
    .maybeSingle()

  if (!quizRow) notFound()
  const quiz = quizRow as {
    id: string; course_id: string; title: string; passing_percent: number
    module_id: string | null; quiz_type: 'module_test' | 'final_assessment'
  }

  // Cross-check the quiz actually belongs to the resolved course —
  // without this, a UUID guess could load another course's quiz under
  // this course's slug.
  if (quiz.course_id !== course.id) notFound()

  // Re-verified here server-side since this directly gates course
  // completion and the certificate — see isQuizUnlocked for the rule.
  const lessonsDone = await isQuizUnlocked(admin, user.id, quiz)

  const { data: questionsRaw } = await admin
    .from('course_quiz_questions')
    .select('id, question_text, options')
    .eq('quiz_id', quiz.id)
    .order('order_num')

  const questions = (questionsRaw ?? []) as { id: string; question_text: string; options: string[] }[]

  const { data: attemptsRaw } = await supabase
    .from('course_quiz_attempts')
    .select('id, score_percent, passed, answers, submitted_at')
    .eq('student_id', user.id)
    .eq('quiz_id', quiz.id)
    .order('submitted_at', { ascending: false })

  const allAttempts = (attemptsRaw ?? []) as {
    id: string; score_percent: number; passed: boolean
    answers: Record<string, string>; submitted_at: string
  }[]

  const latestAttempt = allAttempts[0] ?? null
  const alreadyPassed = allAttempts.some(a => a.passed)

  const { data: completionRow } = await admin
    .from('course_completions')
    .select('id')
    .eq('student_id', user.id)
    .eq('course_id', course.id)
    .maybeSingle()
  const certificateIssued = !!completionRow

  let breakdown: QuestionBreakdownItem[] | null = null
  if (latestAttempt) {
    const { data: fullQuestionsRaw } = await admin
      .from('course_quiz_questions')
      .select('id, question_text, options, correct_answer, explanation')
      .eq('quiz_id', quiz.id)
      .order('order_num')

    const fullQuestions = (fullQuestionsRaw ?? []) as {
      id: string; question_text: string; options: string[]
      correct_answer: string; explanation: string | null
    }[]

    breakdown = buildBreakdown(fullQuestions, latestAttempt.answers)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className="sidebar-layout-main" style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title={quiz.title} subtitle={`${course.title} · ${questions.length} questions · pass mark ${quiz.passing_percent}%`}/>
        <div style={{ padding: '28px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
          <CourseQuizTaker
            quiz={quiz}
            courseSlug={course.slug}
            questions={questions}
            lessonsDone={lessonsDone}
            latestAttempt={latestAttempt}
            allAttempts={allAttempts}
            alreadyPassed={alreadyPassed}
            certificateIssued={certificateIssued}
            initialBreakdown={breakdown}
          />
        </div>
      </main>
    </div>
  )
}
