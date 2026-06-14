export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (!role || !['admin', 'teacher'].includes(role)) return null
  return { user, role }
}

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const sb   = adminSB()

  switch (body.action) {

    // ── PHASE ──────────────────────────────────────────────
    case 'create_phase': {
      const { programId, title, phase_number } = body
      if (!programId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const { data, error } = await sb.from('phases')
        .insert({ program_id: programId, title, phase_number: phase_number ?? 1 })
        .select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, phaseId: (data as { id: string }).id })
    }

    case 'update_phase': {
      const { phaseId, title, description } = body
      if (!phaseId) return NextResponse.json({ error: 'Missing phaseId' }, { status: 400 })
      const { error } = await sb.from('phases')
        .update({ title, description: description ?? null }).eq('id', phaseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'delete_phase': {
      const { phaseId } = body
      if (!phaseId) return NextResponse.json({ error: 'Missing phaseId' }, { status: 400 })
      // Check no modules
      const { data: mods } = await sb.from('modules').select('id').eq('phase_id', phaseId)
      if ((mods ?? []).length > 0)
        return NextResponse.json({ error: 'Remove all modules first' }, { status: 400 })
      const { error } = await sb.from('phases').delete().eq('id', phaseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── MODULE ─────────────────────────────────────────────
    case 'create_module': {
      const { phaseId, title, module_number } = body
      if (!phaseId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const { data, error } = await sb.from('modules')
        .insert({ phase_id: phaseId, title, module_number: module_number ?? 1, is_unlocked: false })
        .select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, moduleId: (data as { id: string }).id })
    }

    case 'update_module': {
      const { moduleId, title } = body
      if (!moduleId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const { error } = await sb.from('modules').update({ title }).eq('id', moduleId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'delete_module': {
      const { moduleId } = body
      if (!moduleId) return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
      // Delete progress records first
      await sb.from('module_progress').delete().eq('module_id', moduleId)
      const { error } = await sb.from('modules').delete().eq('id', moduleId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'toggle_module_unlock': {
      const { moduleId, isUnlocked } = body
      if (!moduleId) return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
      const { error } = await sb.from('modules')
        .update({ is_unlocked: isUnlocked }).eq('id', moduleId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'swap_module_order': {
      const { moduleId1, order1, moduleId2, order2 } = body
      if (!moduleId1 || !moduleId2) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      // Swap module_numbers
      await sb.from('modules').update({ module_number: order1 }).eq('id', moduleId1)
      await sb.from('modules').update({ module_number: order2 }).eq('id', moduleId2)
      return NextResponse.json({ success: true })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
