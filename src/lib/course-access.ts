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
  const { data } = await sb
    .from('course_purchases')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .maybeSingle()
  return !!data
}
