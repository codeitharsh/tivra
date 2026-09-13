export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { checkAndIssueCourseCompletion } from '@/lib/course-completion'
import { getCourseProgress } from '@/lib/course-progress'
import { buildBreakdown } from '@/lib/question-breakdown'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null) as {
      quizId?: string
      answers?: Record<string, string>
    } | null

    const quizId = body?.quizId
    const answers = body?.answers
    if (!quizId || !answers) {
      return NextResponse.json({ error: 'Missing quizId or answers' }, { status: 400 })
    }

    const sb = adminSB()

    const { data: quizData } = await sb
      .from('course_quizzes')
      .select('id, course_id, passing_percent')
      .eq('id', quizId)
      .maybeSingle()

    if (!quizData) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    const quiz = quizData as { id: string; course_id: string; passing_percent: number }

    // Unlike paid-programme assessments, this quiz has no entitlement
    // check to make (self-paced courses are open to any registered
    // user) and no cooldown — it's a "test your knowledge" recap, not a
    // high-stakes gate, so unlimited immediate retakes are allowed. It
    // IS still required for course completion — see course-completion.ts.
    const progress = await getCourseProgress(sb, user.id, quiz.course_id)
    if (progress.totalRequired === 0 || progress.completedRequired < progress.totalRequired) {
      return NextResponse.json({ error: 'Complete all lessons before taking the quiz' }, { status: 403 })
    }

    // Fetch correct answers SERVER-SIDE only.
    const { data: questionsRaw } = await sb
      .from('course_quiz_questions')
      .select('id, question_text, options, correct_answer, explanation')
      .eq('quiz_id', quizId)

    const questions = (questionsRaw ?? []) as {
      id: string; question_text: string; options: string[]
      correct_answer: string; explanation: string | null
    }[]

    let correct = 0
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) correct++
    })

    const scorePercent = questions.length > 0
      ? parseFloat(((correct / questions.length) * 100).toFixed(2))
      : 0
    const didPass = scorePercent >= quiz.passing_percent

    await sb.from('course_quiz_attempts').insert({
      student_id:   user.id,
      quiz_id:      quizId,
      score_percent: scorePercent,
      answers,
      passed:       didPass,
      submitted_at: new Date().toISOString(),
    })

    let completion: { issued: boolean } = { issued: false }
    if (didPass) {
      completion = await checkAndIssueCourseCompletion(sb, user.id, quiz.course_id)
    }

    return NextResponse.json({
      success: true,
      score: scorePercent,
      passed: didPass,
      correct,
      total: questions.length,
      passMark: quiz.passing_percent,
      certificateIssued: completion.issued,
      breakdown: buildBreakdown(questions, answers),
    })

  } catch (err) {
    console.error('[submit-course-quiz] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
