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

async function requireAdmin() {
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
  return role === 'admin' ? user : null
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const sb = adminSB()

    // ── CREATE SUBJECT ─────────────────────────────────────────
    if (body.action === 'create_subject') {
      const { name, description, displayOrder } = body as {
        name?: string; description?: string; displayOrder?: number
      }
      const trimmedName = name?.trim()
      if (!trimmedName) return NextResponse.json({ error: 'Subject name is required' }, { status: 400 })

      const slug = slugify(trimmedName)
      if (!slug) return NextResponse.json({ error: 'Could not derive a valid slug from that name' }, { status: 400 })

      const { data, error } = await sb.from('subjects').insert({
        name: trimmedName, slug,
        description: description?.trim() || null,
        display_order: displayOrder ?? 100,
      }).select('id, slug').single()

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: `A subject with slug "${slug}" already exists` }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, id: data.id, slug: data.slug })
    }

    // ── UPDATE SUBJECT ─────────────────────────────────────────
    if (body.action === 'update_subject') {
      const { subjectId, name, description, displayOrder, isActive } = body as {
        subjectId?: string; name?: string; description?: string
        displayOrder?: number; isActive?: boolean
      }
      if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 })

      const updates: Record<string, unknown> = {}
      if (name !== undefined)         updates.name          = name.trim()
      if (description !== undefined)  updates.description   = description.trim() || null
      if (displayOrder !== undefined) updates.display_order = displayOrder
      if (isActive !== undefined)     updates.is_active      = isActive

      const { error } = await sb.from('subjects').update(updates).eq('id', subjectId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── DELETE SUBJECT ─────────────────────────────────────────
    if (body.action === 'delete_subject') {
      const { subjectId } = body as { subjectId?: string }
      if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 })

      // Best-effort: remove any uploaded PDFs for this subject's notes
      // before the cascade delete removes the rows that reference them.
      const { data: notesRaw } = await sb.from('free_notes').select('notes_url').eq('subject_id', subjectId)
      const paths = ((notesRaw ?? []) as { notes_url: string | null }[])
        .map(n => n.notes_url).filter((p): p is string => !!p)
      if (paths.length > 0) await sb.storage.from('free-notes').remove(paths)

      const { error } = await sb.from('subjects').delete().eq('id', subjectId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── CREATE NOTE (metadata row — file upload is a separate call) ──
    if (body.action === 'create_note') {
      const { subjectId, title, noteNumber } = body as {
        subjectId?: string; title?: string; noteNumber?: number
      }
      if (!subjectId || !title?.trim() || !noteNumber) {
        return NextResponse.json({ error: 'subjectId, title, and noteNumber are required' }, { status: 400 })
      }

      const { data, error } = await sb.from('free_notes').insert({
        subject_id: subjectId, title: title.trim(), note_number: noteNumber,
      }).select('id').single()

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: `Note number ${noteNumber} already exists for this subject` }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, noteId: data.id })
    }

    // ── DELETE NOTE ────────────────────────────────────────────
    if (body.action === 'delete_note') {
      const { noteId } = body as { noteId?: string }
      if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

      const { data: noteRow } = await sb.from('free_notes').select('notes_url').eq('id', noteId).maybeSingle()
      const notesUrl = (noteRow as { notes_url: string | null } | null)?.notes_url
      if (notesUrl) await sb.storage.from('free-notes').remove([notesUrl])

      const { error } = await sb.from('free_notes').delete().eq('id', noteId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[free-notes] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
