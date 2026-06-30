export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ── Auth helper ───────────────────────────────────────────────
async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role
  if (!role || !['admin', 'teacher'].includes(role)) return null

  return { user, role }
}

// ── Admin client (bypasses RLS) ───────────────────────────────
function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ══════════════════════════════════════════════════════════════
//  POST — create a new test with questions
// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {

    const auth = await getAuthUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      action: string
      programId?: string
      phaseId?: string
      weekNumber?: number
      title?: string
      topic?: string
      durationMinutes?: number
      unlockDatetime?: string | null
      isManuallyUnlocked?: boolean
      questions?: {
        question_text: string
        options: string[]
        correct_answer: string
        explanation?: string
      }[]
      // For update actions
      testId?: string
      unlockDatetime2?: string
      questionId?: string
      question?: {
        question_text: string
        options: string[]
        correct_answer: string
        explanation?: string
        order_num?: number
      }
    }

    const sb = adminSB()

    // ── CREATE TEST ───────────────────────────────────────────
    if (body.action === 'create_test') {
      const {
        programId, phaseId, weekNumber, title, topic,
        durationMinutes, unlockDatetime, isManuallyUnlocked, questions,
      } = body

      if (!programId || !phaseId || !weekNumber || !title) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // Insert test
      const { data: testData, error: testErr } = await sb
        .from('weekly_tests')
        .insert({
          program_id:           programId,
          phase_id:             phaseId,
          week_number:          weekNumber,
          title:                title.trim(),
          topic:                topic?.trim() || null,
          duration_minutes:     durationMinutes ?? 30,
          unlock_datetime:      unlockDatetime ?? null,
          is_manually_unlocked: isManuallyUnlocked ?? false,
        })
        .select('id')
        .single()

      if (testErr || !testData) {
        return NextResponse.json({ error: testErr?.message ?? 'Failed to create test' }, { status: 500 })
      }

      const testId = (testData as { id: string }).id

      // Insert questions
      if (questions && questions.length > 0) {
        const qRows = questions.map((q, i) => ({
          test_id:        testId,
          question_text:  q.question_text.trim(),
          options:        q.options,
          correct_answer: q.correct_answer,
          explanation:    q.explanation?.trim() || null,
          order_num:      i + 1,
        }))

        const { error: qErr } = await sb.from('test_questions').insert(qRows)
        if (qErr) {
          // Rollback — delete the test
          await sb.from('weekly_tests').delete().eq('id', testId)
          return NextResponse.json({ error: qErr.message }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, testId })
    }

    // ── ADD QUESTION TO EXISTING TEST ─────────────────────────
    if (body.action === 'add_question') {
      const { testId, question, questions } = body

      if (!testId || (!question && !questions)) {
        return NextResponse.json({ error: 'Missing testId or question' }, { status: 400 })
      }

      // Get current question count for order_num
      const { data: existing } = await sb
        .from('test_questions')
        .select('id')
        .eq('test_id', testId)

      const baseOrder = (existing?.length ?? 0)

      const toInsert = questions
        ? questions.map((q, i) => ({
            test_id:        testId,
            question_text:  q.question_text.trim(),
            options:        q.options,
            correct_answer: q.correct_answer,
            explanation:    q.explanation?.trim() || null,
            order_num:      baseOrder + i + 1,
          }))
        : [{
            test_id:        testId,
            question_text:  question!.question_text.trim(),
            options:        question!.options,
            correct_answer: question!.correct_answer,
            explanation:    question!.explanation?.trim() || null,
            order_num:      baseOrder + 1,
          }]

      const { error } = await sb.from('test_questions').insert(toInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ success: true })
    }

    // ── SAVE SCHEDULE ─────────────────────────────────────────
    if (body.action === 'save_schedule') {
      const { testId, unlockDatetime2 } = body
      if (!testId || !unlockDatetime2) {
        return NextResponse.json({ error: 'Missing testId or datetime' }, { status: 400 })
      }

      const { error } = await sb
        .from('weekly_tests')
        .update({ unlock_datetime: unlockDatetime2, is_manually_unlocked: false })
        .eq('id', testId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── TOGGLE UNLOCK ─────────────────────────────────────────
    if (body.action === 'toggle_unlock') {
      const { testId, isManuallyUnlocked } = body
      if (!testId || isManuallyUnlocked === undefined) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      }

      const { error } = await sb
        .from('weekly_tests')
        .update({ is_manually_unlocked: isManuallyUnlocked })
        .eq('id', testId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[tests POST] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
//  DELETE — delete test or question
// ══════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {

    const auth = await getAuthUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { action: string; testId?: string; questionId?: string }
    const sb   = adminSB()

    if (body.action === 'delete_test') {
      if (!body.testId) return NextResponse.json({ error: 'Missing testId' }, { status: 400 })

      // Delete questions first (foreign key)
      await sb.from('test_questions').delete().eq('test_id', body.testId)
      const { error } = await sb.from('weekly_tests').delete().eq('id', body.testId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete_question') {
      if (!body.questionId) return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })
      const { error } = await sb.from('test_questions').delete().eq('id', body.questionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[tests DELETE] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
//  PATCH — assessment operations
// ══════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {

    const auth = await getAuthUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      action: string
      phaseId?: string
      assessmentId?: string
      title?: string
      totalQuestions?: number
      durationMinutes?: number
      passingPercent?: number
      unlockDatetime?: string
      isManuallyUnlocked?: boolean
      questionId?: string
      question?: {
        question_text: string
        options: string[]
        correct_answer: string
        explanation?: string
      }
      orderNum?: number
    }

    const sb = adminSB()

    // ── CREATE ASSESSMENT ──────────────────────────────────────
    if (body.action === 'create_assessment') {
      const { phaseId, title, totalQuestions, durationMinutes, passingPercent } = body
      if (!phaseId || !title) {
        return NextResponse.json({ error: 'phaseId and title required' }, { status: 400 })
      }

      // Check if assessment already exists for this phase
      const { data: existing } = await sb
        .from('assessments')
        .select('id')
        .eq('phase_id', phaseId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: 'Assessment already exists for this phase' }, { status: 400 })
      }

      const { data, error } = await sb
        .from('assessments')
        .insert({
          phase_id:             phaseId,
          title:                title.trim(),
          total_questions:      totalQuestions ?? 60,
          duration_minutes:     durationMinutes ?? 90,
          passing_percent:      passingPercent ?? 75,
          is_manually_unlocked: false,
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, assessmentId: (data as { id: string }).id })
    }

    // ── UPDATE ASSESSMENT SETTINGS ─────────────────────────────
    if (body.action === 'update_assessment') {
      const { assessmentId, title, totalQuestions, durationMinutes, passingPercent } = body
      if (!assessmentId) return NextResponse.json({ error: 'assessmentId required' }, { status: 400 })

      const updates: Record<string, unknown> = {}
      if (title)            updates.title             = title.trim()
      if (totalQuestions)   updates.total_questions   = totalQuestions
      if (durationMinutes)  updates.duration_minutes  = durationMinutes
      if (passingPercent)   updates.passing_percent   = passingPercent

      const { error } = await sb.from('assessments').update(updates).eq('id', assessmentId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── SAVE ASSESSMENT SCHEDULE ───────────────────────────────
    if (body.action === 'save_assessment_schedule') {
      const { assessmentId, unlockDatetime } = body
      if (!assessmentId || !unlockDatetime) {
        return NextResponse.json({ error: 'assessmentId and unlockDatetime required' }, { status: 400 })
      }
      const { error } = await sb
        .from('assessments')
        .update({ unlock_datetime: unlockDatetime, is_manually_unlocked: false })
        .eq('id', assessmentId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── TOGGLE ASSESSMENT UNLOCK ───────────────────────────────
    if (body.action === 'toggle_assessment_unlock') {
      const { assessmentId, isManuallyUnlocked } = body
      if (!assessmentId || isManuallyUnlocked === undefined) {
        return NextResponse.json({ error: 'assessmentId and isManuallyUnlocked required' }, { status: 400 })
      }
      const { error } = await sb
        .from('assessments')
        .update({ is_manually_unlocked: isManuallyUnlocked })
        .eq('id', assessmentId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── ADD ASSESSMENT QUESTION ────────────────────────────────
    if (body.action === 'add_assessment_question') {
      const { assessmentId, question, orderNum } = body
      if (!assessmentId || !question) {
        return NextResponse.json({ error: 'assessmentId and question required' }, { status: 400 })
      }
      const { error } = await sb.from('assessment_questions').insert({
        assessment_id:  assessmentId,
        question_text:  question.question_text.trim(),
        options:        question.options,
        correct_answer: question.correct_answer,
        explanation:    question.explanation?.trim() || null,
        order_num:      orderNum ?? 1,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── DELETE ASSESSMENT QUESTION ─────────────────────────────
    if (body.action === 'delete_assessment_question') {
      const { questionId } = body
      if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })
      const { error } = await sb.from('assessment_questions').delete().eq('id', questionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[tests PATCH] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
