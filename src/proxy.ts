import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────
//  ROUTE DEFINITIONS
// ─────────────────────────────────────────────────────────────

// 1. Anyone can access — no login needed
const PUBLIC_ROUTES = [
  '/', '/login', '/register', '/verify',
  '/about', '/contact', '/terms', '/privacy',
  '/pending',   // pending/explore page is public so redirect works
  '/payment',   // payment submission page
]

// Programme LANDING pages (e.g. /programs/cloud-launchpad) are public
// marketing pages — anyone can browse before paying. Everything NESTED
// under them (content, tests, assessments, certificate) is paid content.
// Previously this was a hardcoded array of slugs requiring a code change
// for every new programme. Now resolved dynamically against the real
// `programs` table (see isPublicProgrammeLandingPage below) — adding
// programme #3 requires zero changes to this file.

// 2. Admin only
const ADMIN_ROUTES = ['/admin']

// 3. Teacher + admin
const TEACHER_ROUTES = ['/teacher']

// ─────────────────────────────────────────────────────────────
function matches(path: string, routes: string[]) {
  return routes.some(r => path === r || path.startsWith(r + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── STEP 1: Public routes ──────────────────────────────────
  if (matches(pathname, PUBLIC_ROUTES)) {
    // Already logged in + trying to hit login/register → redirect to right place
    if (user && (pathname === '/login' || pathname === '/register')) {
      const { data: pd } = await supabase
        .from('profiles').select('role, access_status').eq('id', user.id).single()
      const p = pd as { role: string; access_status: string } | null
      if (p?.role === 'admin')   return NextResponse.redirect(new URL('/admin',   request.url))
      if (p?.role === 'teacher') return NextResponse.redirect(new URL('/teacher', request.url))
      if (p?.access_status === 'pending_payment')
        return NextResponse.redirect(new URL('/pending', request.url))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // ── STEP 1b: Programme LANDING pages only — a path shaped exactly
  //    like /programs (the listing of all programmes) or
  //    /programs/{slug} (a single programme's marketing page) is
  //    always public, regardless of whether {slug} resolves to a
  //    real, active programme — the page component itself renders a
  //    404 for an unknown slug. Anything with a 3rd path segment
  //    (/programs/{slug}/content) is paid content and falls through
  //    to the auth checks below. Deliberately NOT using the wildcard
  //    matches() helper here — that was the original bug: '/programs'
  //    wildcard-matched into every paid subroute underneath it. ────
  if (pathname === '/programs' || /^\/programs\/[^/]+$/.test(pathname)) {
    return response
  }

  // ── STEP 2: Must be logged in ──────────────────────────────
  if (!user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // ── STEP 3: Load profile ───────────────────────────────────
  const { data: pd } = await supabase
    .from('profiles').select('role, access_status').eq('id', user.id).single()
  const profile = pd as { role: string; access_status: string } | null
  const role   = profile?.role          ?? 'student'
  const status = profile?.access_status ?? 'pending_payment'

  // ── STEP 4: Admin routes ───────────────────────────────────
  if (matches(pathname, ADMIN_ROUTES)) {
    if (role !== 'admin')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    return response
  }

  // ── STEP 5: Teacher routes ─────────────────────────────────
  if (matches(pathname, TEACHER_ROUTES)) {
    if (!['admin', 'teacher'].includes(role))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    return response
  }

  // ── STEP 6: Staff bypass all student gates ─────────────────
  if (['admin', 'teacher'].includes(role)) return response

  // ── STEP 7: Restricted account ────────────────────────────
  if (status === 'restricted') {
    return NextResponse.redirect(new URL('/login?error=restricted', request.url))
  }

  // ── STEP 8: PENDING PAYMENT ────────────────────────────────
  // Student hasn't paid → they see NOTHING except /pending and /payment
  // Every single other route is blocked
  if (status === 'pending_payment') {
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  // ── STEP 9: Active student — but only into programmes they
  //    actually paid for. Any /programs/[slug]/... path that isn't
  //    the bare landing page (already allowed in STEP 1b above) is
  //    paid content — check enrolled_programs for that specific slug,
  //    not just "is this student active at all." Validated against
  //    the REAL programs table, not a hardcoded slug list — this is
  //    what makes the gate scale to any number of programmes without
  //    a code change. ────────────────────────────────────────────
  const programmeMatch = pathname.match(/^\/programs\/([^/]+)\/.+/)
  if (programmeMatch) {
    const slug = programmeMatch[1]

    const { data: prog } = await supabase
      .from('programs')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    // Unknown/inactive programme slug in a content-shaped URL — not
    // this gate's job to 404 it, just don't treat it as a real
    // programme requiring entitlement (the page itself 404s).
    if (prog) {
      const programId = (prog as { id: string }).id
      const { data: enrolled } = await supabase
        .from('enrolled_programs')
        .select('id')
        .eq('student_id', user.id)
        .eq('program_id', programId)
        .maybeSingle()

      if (!enrolled) {
        // Active account, but never paid for THIS specific programme —
        // send them to the explore page for that programme instead of
        // a generic dashboard, so the next step is obviously "enrol."
        return NextResponse.redirect(new URL(`/programs/${slug}`, request.url))
      }
    }
  }

  // ── STEP 10: Active student, entitled to this route — allow ────
  return response
}

export const config = {
  matcher: [
    // Exclude: static files, images, AND all /api routes (they handle auth themselves)
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
