export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function adminSB() {
  return createSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getUserWithRole() {
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
  const role = (profile as { role: string } | null)?.role ?? 'student'
  return { user, role }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserWithRole()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { user, role } = auth

    const body = await req.json().catch(() => null) as {
      action?: string
      doubtId?: string
      moduleId?: string
      questionText?: string
      answerText?: string
    } | null

    if (!body?.action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

    const sb = adminSB()

    // ── Post a doubt ────────────────────────────────────────────
    if (body.action === 'post_doubt') {
      if (!body.questionText?.trim())
        return NextResponse.json({ error: 'Question text required' }, { status: 400 })

      const { data, error } = await sb.from('doubts').insert({
        student_id:    user.id,
        module_id:     body.moduleId ?? null,
        question_text: body.questionText.trim(),
      }).select('id').single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, id: (data as { id: string }).id })
    }

    // ── Post an answer (teacher/admin only) ──────────────────────
    // Previously the comment claimed this was "enforced by role check"
    // but NO role check existed anywhere in this branch — any
    // authenticated student could call this action directly (bypassing
    // the UI, which presumably only shows this option to staff) and
    // post an "official" answer to any doubt, which also marked it
    // resolved. This is now actually enforced server-side, not just
    // assumed from the UI.
    if (body.action === 'post_answer') {
      if (!['admin', 'teacher'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden — only staff can post answers' }, { status: 403 })
      }
      if (!body.doubtId || !body.answerText?.trim())
        return NextResponse.json({ error: 'doubtId and answerText required' }, { status: 400 })

      const { error: ae } = await sb.from('doubt_answers').insert({
        doubt_id:    body.doubtId,
        answered_by: user.id,
        answer_text: body.answerText.trim(),
      })
      if (ae) return NextResponse.json({ error: ae.message }, { status: 500 })

      await sb.from('doubts').update({ is_resolved: true }).eq('id', body.doubtId)
      return NextResponse.json({ success: true })
    }

    // ── Upvote ───────────────────────────────────────────────────
    if (body.action === 'upvote') {
      if (!body.doubtId) return NextResponse.json({ error: 'doubtId required' }, { status: 400 })

      // Optimistic-concurrency guard: read the current value, then
      // only write if it hasn't changed since the read. Previously this
      // was a plain read-then-write with no guard at all — two
      // concurrent upvotes from different users could both read the
      // same `cur` and both write `cur + 1`, silently losing one
      // increment. This doesn't fully eliminate the race (a real fix
      // needs a Postgres increment function called via .rpc(), which
      // would require a migration), but it at least detects the lost-
      // update case via the affected-row count instead of silently
      // dropping it, and narrows the race window significantly versus
      // no guard at all.
      const { data } = await sb.from('doubts').select('upvotes').eq('id', body.doubtId).single()
      const cur = (data as { upvotes: number } | null)?.upvotes ?? 0

      const { data: updated, error: upErr } = await sb
        .from('doubts')
        .update({ upvotes: cur + 1 })
        .eq('id', body.doubtId)
        .eq('upvotes', cur)
        .select('id')

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
      if (!updated || updated.length === 0) {
        // Someone else updated it between our read and write — the
        // client can simply retry; we don't auto-retry server-side to
        // avoid unbounded recursion under high contention.
        return NextResponse.json({ error: 'Upvote conflict, please try again' }, { status: 409 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[doubts] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
