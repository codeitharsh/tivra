export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSB } from '@supabase/supabase-js'
import { isRateLimited, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// This endpoint returns whether a code is valid plus its discount
// amount — without a limit it's a free oracle for enumerating working
// referral codes. 20 tries/10min is generous for a real user
// fat-fingering a code, tight for automated guessing.
const VALIDATE_REFERRAL_LIMIT = { windowMs: 10 * 60 * 1000, max: 20 }

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`validate-referral:${getClientIp(req)}`, VALIDATE_REFERRAL_LIMIT)) {
      return NextResponse.json({ valid: false, error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

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
