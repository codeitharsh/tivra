export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Read-only — returns the logged-in user's own enrolled programmes
// (name + slug only, nothing sensitive). Used by Sidebar.tsx to render
// programme-scoped nav links (Study Content / Tests / Assessments /
// Certificate) for whichever programme(s) the student actually paid
// for, instead of a single hardcoded cloud-launchpad link. Returns an
// empty list for anyone not logged in or with no enrollments — never
// errors out in a way that would break sidebar rendering.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ programs: [] })

  const { data, error } = await supabase
    .from('enrolled_programs')
    .select('programs!program_id(name, slug)')
    .eq('student_id', user.id)

  if (error) return NextResponse.json({ programs: [] })

  // Supabase's generated types for a to-one foreign-key join
  // (programs!program_id) can come back shaped as either a single
  // object or a single-element array depending on the inferred
  // relationship cardinality — handled defensively here rather than
  // force-casting, since a forced cast would silently produce wrong
  // data if the actual runtime shape ever differs from the assumption.
  type JoinedRow = { programs: { name: string; slug: string } | { name: string; slug: string }[] | null }
  const programs = ((data ?? []) as unknown as JoinedRow[])
    .map(row => Array.isArray(row.programs) ? row.programs[0] : row.programs)
    .filter((pr): pr is { name: string; slug: string } => !!pr)

  return NextResponse.json({ programs })
}
