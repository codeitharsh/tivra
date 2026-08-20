export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface PatchBody {
  price_inr?:            number
  original_price_inr?:   number | null
  duration_label?:       string
  is_active?:            boolean
  mode?:                 string
  placement_assistance?: boolean
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const role = (profile as { role: string } | null)?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as PatchBody
    const update: Record<string, unknown> = {}

    if (body.price_inr !== undefined) {
      if (typeof body.price_inr !== 'number' || body.price_inr < 0) {
        return NextResponse.json({ error: 'price_inr must be a non-negative number' }, { status: 400 })
      }
      update.price_inr = body.price_inr
    }
    if (body.original_price_inr !== undefined) {
      if (body.original_price_inr !== null && (typeof body.original_price_inr !== 'number' || body.original_price_inr < 0)) {
        return NextResponse.json({ error: 'original_price_inr must be a non-negative number or null' }, { status: 400 })
      }
      update.original_price_inr = body.original_price_inr
    }
    if (body.duration_label !== undefined) {
      if (typeof body.duration_label !== 'string' || !body.duration_label.trim()) {
        return NextResponse.json({ error: 'duration_label must be a non-empty string' }, { status: 400 })
      }
      update.duration_label = body.duration_label.trim()
    }
    if (body.is_active !== undefined) {
      update.is_active = !!body.is_active
    }
    if (body.mode !== undefined) {
      if (typeof body.mode !== 'string' || !body.mode.trim()) {
        return NextResponse.json({ error: 'mode must be a non-empty string' }, { status: 400 })
      }
      update.mode = body.mode.trim()
    }
    if (body.placement_assistance !== undefined) {
      update.placement_assistance = !!body.placement_assistance
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const sb = adminSB()
    const { error } = await sb.from('programs').update(update).eq('id', id)

    if (error) {
      console.error('[admin/programs] Update failed:', error.message)
      return NextResponse.json({ error: 'Could not update programme' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('[admin/programs] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
