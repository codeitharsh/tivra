import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────
//  ROUTE DEFINITIONS
// ─────────────────────────────────────────────────────────────

// 1. Anyone can access — no login needed
const PUBLIC_ROUTES = [
  '/', '/programs', '/login', '/register', '/verify',
  '/about', '/contact', '/terms', '/privacy',
  '/pending',   // pending page is public so redirect works
  '/payment',   // payment submission page
]

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

  // ── STEP 9: Active student — allow everything ──────────────
  return response
}

export const config = {
  matcher: [
    // Exclude: static files, images, AND all /api routes (they handle auth themselves)
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
