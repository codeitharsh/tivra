export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSB } from '@supabase/supabase-js'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { code?: string } | null
    const raw  = body?.code?.trim()
    if (!raw) return NextResponse.json({ valid: false, error: 'No code provided' }, { status: 400 })

    const sb = adminSB()
    const { data, error } = await sb
      .from('faculty_referrals')
      .select('id, faculty_name, discount_amount')
      .ilike('referral_code', raw)   // case-insensitive match
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ valid: false, error: 'Invalid referral code.' })
    }

    const row = data as { id: string; faculty_name: string; discount_amount: number }
    return NextResponse.json({
      valid:          true,
      referral_id:    row.id,
      faculty_name:   row.faculty_name,
      discount:       row.discount_amount,
    })
  } catch (err) {
    console.error('[validate-referral]', err)
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 })
  }
}
