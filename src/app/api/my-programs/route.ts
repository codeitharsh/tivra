export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Uses the service-role client for the enrolled_programs→programs join
// because RLS policies on these tables silently return empty results
// when queried through the anon client — the join to programs comes
// back null even when the enrollment row exists, causing the sidebar
// to show no programme nav links for a legitimately enrolled student.
function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const cookieStore = await cookies()
  // Use anon client ONLY for auth — to verify who this user is
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ programs: [] })

  // Use admin client for data — bypasses RLS on enrolled_programs/programs
  const sb = adminSB()
  const { data, error } = await sb
    .from('enrolled_programs')
    .select('programs!program_id(name, slug)')
    .eq('student_id', user.id)

  if (error) return NextResponse.json({ programs: [] })

  type JoinedRow = { programs: { name: string; slug: string } | { name: string; slug: string }[] | null }
  const programs = ((data ?? []) as unknown as JoinedRow[])
    .map(row => Array.isArray(row.programs) ? row.programs[0] : row.programs)
    .filter((pr): pr is { name: string; slug: string } => !!pr)

  return NextResponse.json({ programs })
}
