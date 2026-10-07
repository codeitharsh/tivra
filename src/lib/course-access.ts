import type { SupabaseClient } from '@supabase/supabase-js'

// A course is free unless price_inr is set and positive — used
// everywhere a course's price needs interpreting consistently (landing
// page, lesson/quiz gates, catalog card).
export function isPaidCourse(priceInr: number | null): boolean {
  return !!priceInr && priceInr > 0
}

export async function hasPurchasedCourse(
  sb: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<boolean> {
  const { data: direct } = await sb
    .from('course_purchases')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (direct) return true

  // Also unlocked if the student bought a career-path bundle that
  // includes this course — centralized here so every existing call site
  // (lesson gate, quiz submit, progress-mark API) picks up bundle
  // entitlement automatically, with no separate gate to keep in sync.
  const { data: pathLinks } = await sb
    .from('career_path_courses')
    .select('career_path_id')
    .eq('course_id', courseId)
  const pathIds = ((pathLinks ?? []) as { career_path_id: string }[]).map(p => p.career_path_id)
  if (pathIds.length === 0) return false

  const { data: bundlePurchase } = await sb
    .from('career_path_purchases')
    .select('id')
    .eq('student_id', studentId)
    .in('career_path_id', pathIds)
    .limit(1)
    .maybeSingle()
  return !!bundlePurchase
}
