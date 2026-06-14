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
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    assessmentId: string
    answers:      Record<string, string>
  }

  const { assessmentId, answers } = body
  if (!assessmentId || !answers) {
    return NextResponse.json({ error: 'Missing assessmentId or answers' }, { status: 400 })
  }

  const sb = adminSB()

  // Check 24-hour cooldown
  const { data: attemptsRaw } = await sb
    .from('assessment_attempts')
    .select('submitted_at, passed')
    .eq('student_id', user.id)
    .eq('assessment_id', assessmentId)
    .order('submitted_at', { ascending: false })
    .limit(1)

  const lastAttempt = (attemptsRaw ?? [])[0] as
    { submitted_at: string; passed: boolean } | undefined

  if (lastAttempt) {
    if (lastAttempt.passed) {
      return NextResponse.json({ error: 'Already passed this assessment' }, { status: 409 })
    }
    const cooldownUntil = new Date(lastAttempt.submitted_at).getTime() + 24 * 3600 * 1000
    if (Date.now() < cooldownUntil) {
      return NextResponse.json({
        error: 'Cooldown active',
        retakeAt: new Date(cooldownUntil).toISOString(),
      }, { status: 429 })
    }
  }

  // Verify assessment is unlocked
  const { data: assessData } = await sb
    .from('assessments')
    .select('is_manually_unlocked, unlock_datetime, passing_percent, phase_id')
    .eq('id', assessmentId)
    .single()

  if (!assessData) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

  const a = assessData as {
    is_manually_unlocked: boolean; unlock_datetime: string | null
    passing_percent: number; phase_id: string
  }
  const isUnlocked = a.is_manually_unlocked ||
    (a.unlock_datetime ? new Date() >= new Date(a.unlock_datetime) : false)

  if (!isUnlocked) {
    return NextResponse.json({ error: 'Assessment not yet available' }, { status: 403 })
  }

  // Fetch correct answers SERVER-SIDE
  const { data: questionsRaw } = await sb
    .from('assessment_questions')
    .select('id, correct_answer')
    .eq('assessment_id', assessmentId)

  const questions = (questionsRaw ?? []) as { id: string; correct_answer: string }[]

  // Compute score server-side
  let correct = 0
  questions.forEach(q => {
    if (answers[q.id] === q.correct_answer) correct++
  })

  const scorePercent = questions.length > 0
    ? parseFloat(((correct / questions.length) * 100).toFixed(2))
    : 0
  const didPass = scorePercent >= a.passing_percent

  // Save attempt
  await sb.from('assessment_attempts').insert({
    student_id:    user.id,
    assessment_id: assessmentId,
    score_percent: scorePercent,
    answers,
    passed:        didPass,
    submitted_at:  new Date().toISOString(),
  })

  // Auto-issue certificate if passed
  if (didPass) {
    await sb.from('certificates').upsert({
      student_id:    user.id,
      assessment_id: assessmentId,
      phase_id:      a.phase_id,
      score_percent: scorePercent,
      issued_at:     new Date().toISOString(),
      issued_by:     'auto',
      is_revoked:    false,
    }, { onConflict: 'student_id,assessment_id' })
  }

  return NextResponse.json({
    success:  true,
    score:    scorePercent,
    passed:   didPass,
    correct,
    total:    questions.length,
    passMark: a.passing_percent,
  })
}
