export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import TestTaker from './TestTaker'
import { requireActiveStudent } from '@/lib/access-gate'
import { requireProgramAccess } from '@/lib/program-access'
import { buildBreakdown, type QuestionBreakdownItem } from '@/lib/question-breakdown'
import type { Profile } from '@/types/database'

export default async function TakeTestPage({
  params,
}: {
  params: Promise<{ slug: string; testId: string }>
}) {
  const { slug, testId } = await params
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  // Defense-in-depth — see src/lib/access-gate.ts.
  requireActiveStudent(profile)

  const admin = createAdminClient()

  // Resolve programme + check entitlement (previously MISSING entirely
  // on this page).
  const program = await requireProgramAccess(admin, profile, slug)

  const { data: testData } = await admin
    .from('weekly_tests')
    .select('*')
    .eq('id', testId)
    .single()

  if (!testData) notFound()

  const test = testData as {
    id: string; title: string; topic: string | null
    unlock_datetime: string | null; duration_minutes: number
    is_manually_unlocked: boolean; week_number: number
    program_id: string; batch_id: string | null
  }

  // Cross-check: this test must belong to the resolved programme.
  // weekly_tests has program_id directly, so this is a simple equality
  // check rather than a join — without it, a student entitled to
  // Programme A could load Programme B's test by guessing its UUID.
  if (test.program_id !== program.id) notFound()

  // Same batch check as the tests-list page — a test scoped to a batch
  // the student isn't in must 404 here too, not just be hidden from the
  // list (otherwise the list filter alone is cosmetic; the direct URL
  // would still work for any enrolled student who knows/guesses the id).
  if (test.batch_id && test.batch_id !== profile.batch_id) notFound()

  const now       = new Date()
  const isUnlocked = test.is_manually_unlocked ||
    (test.unlock_datetime ? now >= new Date(test.unlock_datetime) : false)

  const { data: attempt } = await supabase
    .from('test_attempts')
    .select('score_percent, answers, submitted_at')
    .eq('student_id', user.id)
    .eq('test_id', testId)
    .maybeSingle()

  const existingAttempt = attempt as {
    score_percent: number; answers: Record<string, string>; submitted_at: string
  } | null

  const { data: questionsRaw } = await admin
    .from('test_questions')
    .select('id, question_text, options')
    .eq('test_id', testId)
    .order('order_num')

  const questions = (questionsRaw ?? []) as {
    id: string; question_text: string; options: string[]
  }[]

  // Only fetched when an attempt already exists — correct_answer must
  // never reach the client before that point. Powers the "review your
  // answers" report on a return visit, not just right after a fresh
  // submit (which gets its own breakdown from the submit API response).
  let breakdown: QuestionBreakdownItem[] | null = null
  if (existingAttempt) {
    const { data: fullQuestionsRaw } = await admin
      .from('test_questions')
      .select('id, question_text, options, correct_answer, explanation')
      .eq('test_id', testId)
      .order('order_num')

    const fullQuestions = (fullQuestionsRaw ?? []) as {
      id: string; question_text: string; options: string[]
      correct_answer: string; explanation: string | null
    }[]

    breakdown = buildBreakdown(fullQuestions, existingAttempt.answers)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title={`Week ${test.week_number}: ${test.topic ?? test.title}`}
          subtitle={`${questions.length} questions · ${test.duration_minutes} minutes`}
        />
        <div style={{ padding: '28px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <TestTaker
            test={test}
            questions={questions}
            isUnlocked={isUnlocked}
            existingAttempt={existingAttempt}
            initialBreakdown={breakdown}
            studentId={user.id}
            slug={slug}
          />
        </div>
      </main>
    </div>
  )
}
