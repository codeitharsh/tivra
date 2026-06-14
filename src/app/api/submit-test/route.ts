export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // Verify authenticated student
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    testId: string
    answers: Record<string, string>  // { questionId: "A" | "B" | "C" | "D" }
  }

  const { testId, answers } = body
  if (!testId || !answers) {
    return NextResponse.json({ error: 'Missing testId or answers' }, { status: 400 })
  }

  const sb = adminSB()

  // Check already attempted (one attempt per student per test)
  const { data: existing } = await sb
    .from('test_attempts')
    .select('id')
    .eq('student_id', user.id)
    .eq('test_id', testId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Already attempted' }, { status: 409 })
  }

  // Verify test is unlocked
  const { data: testData } = await sb
    .from('weekly_tests')
    .select('is_manually_unlocked, unlock_datetime')
    .eq('id', testId)
    .single()

  if (!testData) return NextResponse.json({ error: 'Test not found' }, { status: 404 })

  const t = testData as { is_manually_unlocked: boolean; unlock_datetime: string | null }
  const isUnlocked = t.is_manually_unlocked ||
    (t.unlock_datetime ? new Date() >= new Date(t.unlock_datetime) : false)

  if (!isUnlocked) {
    return NextResponse.json({ error: 'Test not yet available' }, { status: 403 })
  }

  // Fetch correct answers SERVER-SIDE only
  const { data: questionsRaw } = await sb
    .from('test_questions')
    .select('id, correct_answer')
    .eq('test_id', testId)

  const questions = (questionsRaw ?? []) as { id: string; correct_answer: string }[]

  // Compute score server-side
  let correct = 0
  questions.forEach(q => {
    if (answers[q.id] === q.correct_answer) correct++
  })

  const scorePercent = questions.length > 0
    ? parseFloat(((correct / questions.length) * 100).toFixed(2))
    : 0

  // Save attempt with verified score
  const { error } = await sb.from('test_attempts').insert({
    student_id:    user.id,     // always the authenticated user
    test_id:       testId,
    score_percent: scorePercent,
    answers,
    submitted_at:  new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    score:   scorePercent,
    correct,
    total:   questions.length,
  })
}
