import { createBrowserClient } from '@supabase/ssr'

// A dedicated implicit-flow client for password recovery ONLY — the
// shared factory in ./client.ts stays PKCE for normal login. Password
// recovery is inherently a two-visit flow (submit on forgot-password,
// complete later from an email click, possibly minutes apart) — PKCE's
// code_verifier has to survive that gap in the SAME browser storage, and
// in practice it didn't reliably ("PKCE code verifier not found in
// storage" even with the verifier cookie still present and unexpired at
// the time of failure). Implicit flow sends the credential directly,
// self-contained, in the recovery link itself — nothing to store or
// match up later, which is exactly why Supabase used this pattern for
// password reset for years before PKCE existed.
export function createRecoveryClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  )
}
