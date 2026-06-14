import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import AssessmentTaker from './AssessmentTaker'
import type { Profile } from '@/types/database'

export default async function TakeAssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>
}) {
  const { assessmentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  // Fetch assessment
  const { data: assessmentData } = await admin
    .from('assessments')
    .select('*, phases!phase_id(title, phase_number)')
    .eq('id', assessmentId)
    .single()

  if (!assessmentData) notFound()

  const assessment = assessmentData as {
    id: string
    title: string
    total_questions: number
    duration_minutes: number
    passing_percent: number
    unlock_datetime: string | null
    is_manually_unlocked: boolean
    phases: { title: string; phase_number: number } | null
  }

  // Check if assessment is unlocked
  const now = new Date()
  const isUnlocked = assessment.is_manually_unlocked ||
    (assessment.unlock_datetime ? now >= new Date(assessment.unlock_datetime) : false)

  // Fetch ALL attempts by this student — ordered latest first
  const { data: attemptsRaw } = await supabase
    .from('assessment_attempts')
    .select('id, score_percent, passed, answers, submitted_at')
    .eq('student_id', user.id)
    .eq('assessment_id', assessmentId)
    .order('submitted_at', { ascending: false })

  const allAttempts = (attemptsRaw ?? []) as {
    id: string
    score_percent: number
    passed: boolean
    answers: Record<string, string>
    submitted_at: string
  }[]

  const latestAttempt = allAttempts[0] ?? null
  const attemptCount  = allAttempts.length

  // 24-hour cooldown check (only applies when last attempt was a FAIL)
  let canRetake      = true
  let retakeUnlocksAt: Date | null = null

  if (latestAttempt && !latestAttempt.passed) {
    const submittedAt   = new Date(latestAttempt.submitted_at)
    const cooldownUntil = new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000)
    if (now < cooldownUntil) {
      canRetake        = false
      retakeUnlocksAt  = cooldownUntil
    }
  }

  // Already passed — no need to retake
  const alreadyPassed = latestAttempt?.passed === true

  // Fetch questions
  const { data: questionsRaw } = await admin
    .from('assessment_questions')
    .select('id, question_text, options')
    .eq('assessment_id', assessmentId)
    .order('order_num')

  const questions = (questionsRaw ?? []) as {
    id: string
    question_text: string
    options: string[]
  }[]

  const phase = assessment.phases

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile} />
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar
          title={assessment.title}
          subtitle={`Phase ${phase?.phase_number ?? ''}: ${phase?.title ?? ''} · ${assessment.total_questions} questions · ${assessment.duration_minutes} min`}
        />
        <div style={{ padding: '28px', maxWidth: '860px' }}>
          <AssessmentTaker
            assessment={assessment}
            questions={questions}
            isUnlocked={isUnlocked}
            latestAttempt={latestAttempt}
            allAttempts={allAttempts}
            attemptCount={attemptCount}
            canRetake={canRetake}
            retakeUnlocksAt={retakeUnlocksAt?.toISOString() ?? null}
            alreadyPassed={alreadyPassed}
            studentId={user.id}
            studentName={profile.full_name ?? 'Student'}
          />
        </div>
      </main>
    </div>
  )
}
