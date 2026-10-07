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

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function toArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean)
  if (typeof input === 'string') return input.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  return []
}

async function requireStaff() {
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
  return ['admin', 'teacher'].includes(role ?? '') ? user : null
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireStaff()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const sb = adminSB()

    // ── CAREER PATHS ─────────────────────────────────────────
    if (body.action === 'create_career_path') {
      const { title, description, skills, priceInr, originalPriceInr } = body as {
        title?: string; description?: string; skills?: string
        priceInr?: number; originalPriceInr?: number
      }
      const trimmedTitle = title?.trim()
      if (!trimmedTitle) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

      const slug = slugify(trimmedTitle)
      if (!slug) return NextResponse.json({ error: 'Could not derive a valid slug from that title' }, { status: 400 })

      const { data, error } = await sb.from('career_paths').insert({
        title: trimmedTitle, slug,
        description: description?.trim() || null,
        skills: toArray(skills),
        price_inr: priceInr || null,
        original_price_inr: originalPriceInr || null,
        created_by: user.id,
      }).select('id, slug').single()

      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: `A career path with slug "${slug}" already exists` }, { status: 409 })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, id: data.id, slug: data.slug })
    }

    if (body.action === 'update_career_path') {
      const { careerPathId, title, description, skills, priceInr, originalPriceInr, status, displayOrder } = body as {
        careerPathId?: string; title?: string; description?: string; skills?: string
        priceInr?: number | null; originalPriceInr?: number | null; status?: string; displayOrder?: number
      }
      if (!careerPathId) return NextResponse.json({ error: 'careerPathId required' }, { status: 400 })

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title !== undefined)       updates.title = title.trim()
      if (description !== undefined) updates.description = description.trim() || null
      if (skills !== undefined)      updates.skills = toArray(skills)
      if (priceInr !== undefined)    updates.price_inr = priceInr || null
      if (originalPriceInr !== undefined) updates.original_price_inr = originalPriceInr || null
      if (status !== undefined && ['draft', 'published'].includes(status)) updates.status = status
      if (displayOrder !== undefined) updates.display_order = displayOrder

      const { error } = await sb.from('career_paths').update(updates).eq('id', careerPathId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete_career_path') {
      const { careerPathId } = body as { careerPathId?: string }
      if (!careerPathId) return NextResponse.json({ error: 'careerPathId required' }, { status: 400 })
      const { error } = await sb.from('career_paths').delete().eq('id', careerPathId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── MEMBER COURSES ───────────────────────────────────────
    if (body.action === 'add_course_to_path') {
      const { careerPathId, courseId } = body as { careerPathId?: string; courseId?: string }
      if (!careerPathId || !courseId) return NextResponse.json({ error: 'careerPathId and courseId are required' }, { status: 400 })

      const { data: existing } = await sb.from('career_path_courses').select('display_order').eq('career_path_id', careerPathId).order('display_order', { ascending: false }).limit(1)
      const nextOrder = ((existing?.[0] as { display_order: number } | undefined)?.display_order ?? 0) + 1

      const { error } = await sb.from('career_path_courses').insert({
        career_path_id: careerPathId, course_id: courseId, display_order: nextOrder,
      })
      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'This course is already in the career path' }, { status: 409 })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (body.action === 'remove_course_from_path') {
      const { careerPathId, courseId } = body as { careerPathId?: string; courseId?: string }
      if (!careerPathId || !courseId) return NextResponse.json({ error: 'careerPathId and courseId are required' }, { status: 400 })
      const { error } = await sb.from('career_path_courses').delete().eq('career_path_id', careerPathId).eq('course_id', courseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[admin/career-paths] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
