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
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface CreateBody {
  name?:                  string
  slug?:                  string
  description?:           string
  tagline?:               string
  price_inr?:             number
  original_price_inr?:    number
  duration_label?:        string
  mode?:                  string
  difficulty?:            'beginner' | 'intermediate' | 'advanced'
  instructor_name?:       string
  instructor_title?:      string
  placement_assistance?:  boolean
  is_active?:             boolean
  display_order?:         number
}

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json() as CreateBody

    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Programme name is required' }, { status: 400 })
    }

    // Slug always re-derived server-side from whatever the client sent (or
    // from the name if left blank) — never trust the client's slug as-is,
    // since it becomes a public URL segment (/programs/[slug]).
    const slug = slugify(body.slug?.trim() || name)
    if (!slug) {
      return NextResponse.json({ error: 'Could not derive a valid slug from that name' }, { status: 400 })
    }

    if (body.price_inr !== undefined && (typeof body.price_inr !== 'number' || body.price_inr < 0)) {
      return NextResponse.json({ error: 'price_inr must be a non-negative number' }, { status: 400 })
    }
    if (body.original_price_inr !== undefined && (typeof body.original_price_inr !== 'number' || body.original_price_inr < 0)) {
      return NextResponse.json({ error: 'original_price_inr must be a non-negative number' }, { status: 400 })
    }
    if (body.display_order !== undefined && (typeof body.display_order !== 'number' || body.display_order < 0)) {
      return NextResponse.json({ error: 'display_order must be a non-negative number' }, { status: 400 })
    }
    if (body.difficulty !== undefined && !['beginner', 'intermediate', 'advanced'].includes(body.difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty value' }, { status: 400 })
    }

    const sb = adminSB()
    const { data, error } = await sb.from('programs').insert({
      name,
      slug,
      description:           body.description?.trim() || null,
      tagline:                body.tagline?.trim() || null,
      price_inr:              body.price_inr ?? null,
      original_price_inr:     body.original_price_inr ?? null,
      duration_label:         body.duration_label?.trim() || null,
      mode:                   body.mode?.trim() || 'Live Online',
      difficulty:             body.difficulty ?? null,
      instructor_name:        body.instructor_name?.trim() || null,
      instructor_title:       body.instructor_title?.trim() || null,
      instructor_bio:         null,
      learning_outcomes:      [],
      curriculum_url:         null,
      faqs:                   null,
      placement_assistance:   !!body.placement_assistance,
      is_active:              body.is_active ?? false,
      display_order:          body.display_order ?? 999,
    }).select('id, slug').single()

    if (error) {
      // Postgres unique_violation on the slug column
      if (error.code === '23505') {
        return NextResponse.json({ error: `A programme with slug "${slug}" already exists` }, { status: 409 })
      }
      console.error('[admin/programs] Create failed:', error.message)
      return NextResponse.json({ error: 'Could not create programme' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id, slug: data.slug })

  } catch (err) {
    console.error('[admin/programs] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
