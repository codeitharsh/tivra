import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import TestTaker from './TestTaker'
import type { Profile } from '@/types/database'

export default async function TakeTestPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const { testId } = await params
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  // Fetch test
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
  }

  // Check if unlocked
  const now       = new Date()
  const isUnlocked = test.is_manually_unlocked ||
    (test.unlock_datetime ? now >= new Date(test.unlock_datetime) : false)

  // Check if already attempted
  const { data: attempt } = await supabase
    .from('test_attempts')
    .select('score_percent, answers, submitted_at')
    .eq('student_id', user.id)
    .eq('test_id', testId)
    .maybeSingle()

  const existingAttempt = attempt as {
    score_percent: number; answers: Record<string, string>; submitted_at: string
  } | null

  // Fetch questions
  const { data: questionsRaw } = await admin
    .from('test_questions')
    .select('id, question_text, options')
    .eq('test_id', testId)
    .order('order_num')

  const questions = (questionsRaw ?? []) as {
    id: string; question_text: string; options: string[]
  }[]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title={`Week ${test.week_number}: ${test.topic ?? test.title}`}
          subtitle={`${questions.length} questions · ${test.duration_minutes} minutes`}
        />
        <div style={{ padding: '28px', maxWidth: '800px' }}>
          <TestTaker
            test={test}
            questions={questions}
            isUnlocked={isUnlocked}
            existingAttempt={existingAttempt}
            studentId={user.id}
          />
        </div>
      </main>
    </div>
  )
}
