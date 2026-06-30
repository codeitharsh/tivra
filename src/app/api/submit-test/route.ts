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
  try {
    // Verify authenticated student
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null) as {
      testId?: string
      answers?: Record<string, string>  // { questionId: "A" | "B" | "C" | "D" }
    } | null

    const testId  = body?.testId
    const answers = body?.answers
    if (!testId || !answers) {
      return NextResponse.json({ error: 'Missing testId or answers' }, { status: 400 })
    }

    const sb = adminSB()

    // ── Entitlement check ────────────────────────────────────────
    // Previously this route fetched the test by ID with no check that
    // the calling student is actually enrolled in the programme it
    // belongs to. A student could submit answers for (and get a real
    // score recorded for) a test from a programme they never paid
    // for, simply by knowing or guessing its UUID — weekly_tests has
    // program_id directly, so this is a single extra lookup, not a
    // join. Checked BEFORE the unlock/already-attempted checks below
    // so an unentitled student gets a clear "not enrolled" reason
    // rather than a confusing "not found"/"not yet available".
    const { data: testProgram } = await sb
      .from('weekly_tests')
      .select('program_id')
      .eq('id', testId)
      .maybeSingle()

    if (!testProgram) return NextResponse.json({ error: 'Test not found' }, { status: 404 })

    const programId = (testProgram as { program_id: string | null }).program_id
    if (programId) {
      const { data: enrolled } = await sb
        .from('enrolled_programs')
        .select('id')
        .eq('student_id', user.id)
        .eq('program_id', programId)
        .maybeSingle()

      if (!enrolled) {
        return NextResponse.json({ error: 'You are not enrolled in the programme this test belongs to.' }, { status: 403 })
      }
    }

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

  } catch (err) {
    console.error('[submit-test] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
