export const runtime = 'edge'

import { createClient as createSB } from '@supabase/supabase-js'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Public, read-only list of active programmes — the single source
// client components (homepage, checkout) fetch pricing/duration from,
// instead of hardcoding it. Server components query `programs`
// directly instead of calling this route.
export async function GET(): Promise<Response> {
  try {
    const sb = adminSB()
    const { data, error } = await sb
      .from('programs')
      .select('id, slug, name, tagline, description, price_inr, duration_label, difficulty, learning_outcomes')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[api/programs] Query failed:', error.message)
      return Response.json({ error: 'Could not load programmes.' }, { status: 500 })
    }

    return Response.json({ programs: data ?? [] })

  } catch (err) {
    console.error('[api/programs] Unexpected error:', err)
    return Response.json({ error: 'Could not load programmes.' }, { status: 500 })
  }
}
