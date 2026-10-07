export const runtime = 'edge'

import { createClient as createSB } from '@supabase/supabase-js'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Public, read-only list of published self-paced courses — same pattern
// as /api/programs, for the homepage's client-rendered "Featured
// Courses" section. Server components (courses/explore pages) query
// `courses` directly instead of calling this route.
export async function GET(): Promise<Response> {
  try {
    const sb = adminSB()
    const [{ data, error }, { count: totalCourses }, { count: totalPaths }] = await Promise.all([
      sb.from('courses')
        .select('id, slug, title, description, difficulty, estimated_duration_minutes, skills, cover_image_path, price_inr, original_price_inr')
        .eq('status', 'published')
        .order('display_order', { ascending: true })
        .limit(6),
      sb.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      sb.from('career_paths').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    ])

    if (error) {
      console.error('[api/featured-courses] Query failed:', error.message)
      return Response.json({ error: 'Could not load courses.' }, { status: 500 })
    }

    return Response.json({ courses: data ?? [], totalCourses: totalCourses ?? 0, totalPaths: totalPaths ?? 0 })

  } catch (err) {
    console.error('[api/featured-courses] Unexpected error:', err)
    return Response.json({ error: 'Could not load courses.' }, { status: 500 })
  }
}
