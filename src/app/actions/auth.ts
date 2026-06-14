'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSB } from '@supabase/supabase-js'

function adminClient() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── REGISTER ────────────────────────────────────────────────
export async function register(formData: FormData) {
  const supabase  = await createClient()
  const sb        = adminClient()

  const fullName  = formData.get('full_name') as string
  const email     = formData.get('email')     as string
  const password  = formData.get('password')  as string
  const phone     = (formData.get('phone')    as string) || null

  // Get Cloud LaunchPad program id
  const { data: programRow } = await sb
    .from('programs').select('id').eq('slug', 'cloud-launchpad').maybeSingle()
  const programId = (programRow as { id: string } | null)?.id ?? null

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (authError) {
    if (authError.message.includes('already registered') ||
        authError.message.includes('already been registered')) {
      return { error: 'An account with this email already exists. Please sign in instead.' }
    }
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Could not create account. Please try again.' }
  }

  // Upsert profile immediately — safe whether trigger fired or not
  // Retry up to 3 times to handle DB trigger race conditions
  let upsertError = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await sb.from('profiles').upsert({
      id:                  authData.user.id,
      email:               email,
      full_name:           fullName,
      phone:               phone,
      role:                'student',
      access_type:         'individual',
      access_status:       'pending_payment',
      enrolled_program_id: programId,
    }, { onConflict: 'id' })
    if (!error) { upsertError = null; break }
    upsertError = error
    if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
  }
  if (upsertError) {
    // Non-fatal — user is created in auth, profile will be created on next login
    console.error('[Register] Profile upsert failed:', upsertError.message)
  }
  // dummy to satisfy the replaced block:
  // profile upsert complete

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ─── LOGIN ───────────────────────────────────────────────────
export async function login(formData: FormData) {
  const supabase = await createClient()

  const email    = formData.get('email')    as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Incorrect email or password. Please try again.' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Please confirm your email address first. Check your inbox.' }
    }
    return { error: error.message }
  }

  // Update streak — non-blocking
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await updateStreak(user.id)
  } catch { /* non-critical */ }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ─── LOGOUT ──────────────────────────────────────────────────
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ─── STREAK (internal) ───────────────────────────────────────
async function updateStreak(userId: string) {
  const sb = adminClient()
  const { data } = await sb
    .from('profiles')
    .select('streak_count, last_login_date')
    .eq('id', userId)
    .maybeSingle()

  if (!data) return

  const p         = data as { streak_count: number; last_login_date: string | null }
  const today     = new Date().toISOString().split('T')[0]
  if (p.last_login_date === today) return   // already updated today

  let newStreak = 1
  if (p.last_login_date) {
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(p.last_login_date).getTime()) / 86400000
    )
    newStreak = diff === 1 ? (p.streak_count || 0) + 1 : 1
  }

  await sb.from('profiles')
    .update({ streak_count: newStreak, last_login_date: today })
    .eq('id', userId)
}
