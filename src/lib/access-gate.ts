import { redirect } from 'next/navigation'
import type { Profile } from '@/types/database'

// ── Defense-in-depth access gate ─────────────────────────────
// proxy.ts (middleware) is the primary gate blocking restricted and
// pending-payment students before any page renders. This helper is a
// second, independent check called directly inside each student-facing
// page — so that if middleware is ever bypassed, misconfigured, or
// fails to run for any request, no page can render real student data
// (dashboard stats, study content, tests, certificates, etc.) for an
// account that hasn't paid or has been restricted.
//
// Call this immediately after loading the profile, before any data
// fetching or rendering happens. Admin/teacher roles bypass this gate
// entirely — staff routes have their own role checks.
export function requireActiveStudent(profile: Profile): void {
  if (['admin', 'teacher'].includes(profile.role)) return

  if (profile.access_status === 'restricted') {
    redirect('/login?error=restricted')
  }
  if (profile.access_status === 'pending_payment') {
    redirect('/pending')
  }
}
