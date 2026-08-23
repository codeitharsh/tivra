// Shared by submit-test/submit-assessment (fresh-submit response) and
// the test/assessment [id]/page.tsx server components (review of an
// already-submitted attempt) — one place computing "what did the
// student pick vs. what was actually correct" so both call sites stay
// in sync. Only ever called AFTER an attempt exists (fresh submit just
// happened, or existingAttempt was found server-side) — correct_answer
// must never reach the client before that point.

export interface QuestionBreakdownItem {
  id: string
  question_text: string
  options: string[]
  correct_answer: string
  student_answer: string | null
  is_correct: boolean
  explanation: string | null
}

export function buildBreakdown(
  questions: {
    id: string
    question_text: string
    options: string[]
    correct_answer: string
    explanation?: string | null
  }[],
  answers: Record<string, string>
): QuestionBreakdownItem[] {
  return questions.map(q => {
    const student_answer = answers[q.id] ?? null
    return {
      id: q.id,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      student_answer,
      is_correct: student_answer !== null && student_answer === q.correct_answer,
      explanation: q.explanation ?? null,
    }
  })
}
