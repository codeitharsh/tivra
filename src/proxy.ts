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

// Programme LANDING pages are public (marketing pages — anyone can browse
// before paying), but everything NESTED under them (content, tests,
// assessments, certificate) is paid content and must NOT match here.
// Previously '/programs' matched with startsWith(), which made every
// nested route public too — e.g. /programs/cloud-launchpad/content was
// reachable by a logged-out visitor with zero payment check.
const PUBLIC_PROGRAMME_LANDING_PAGES = [
  '/programs',
  '/programs/cloud-launchpad',
  '/programs/cloud-architect',
]

// Paid content routes — require an active enrollment in the SPECIFIC
// programme, checked against enrolled_programs, not just access_status.
const PROGRAMME_SLUGS = ['cloud-launchpad', 'cloud-architect']

// 2. Admin only
const ADMIN_ROUTES = ['/admin']

// 3. Teacher + admin
const TEACHER_ROUTES = ['/teacher']

// ─────────────────────────────────────────────────────────────
function matches(path: string, routes: string[]) {
  return routes.some(r => path === r || path.startsWith(r + '/'))
}

// Exact match only — used for the programme landing pages, which must
// NOT wildcard-match their nested paid-content subroutes.
function exactMatch(path: string, routes: string[]) {
  return routes.includes(path)
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

  // ── STEP 1b: Programme LANDING pages only — exact match, never
  //    wildcards into the paid content nested underneath. ────────
  if (exactMatch(pathname, PUBLIC_PROGRAMME_LANDING_PAGES)) {
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
  //    not just "is this student active at all." ──────────────────
  const programmeMatch = pathname.match(/^\/programs\/([^/]+)\/.+/)
  if (programmeMatch) {
    const slug = programmeMatch[1]
    if (PROGRAMME_SLUGS.includes(slug)) {
      const { data: enrolledRaw } = await supabase
        .from('enrolled_programs')
        .select('id, programs!program_id(slug)')
        .eq('student_id', user.id)

      const enrolledSlugs = ((enrolledRaw ?? []) as { programs: { slug: string } | null }[])
        .map(e => e.programs?.slug)
        .filter((s): s is string => !!s)

      if (!enrolledSlugs.includes(slug)) {
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
