export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function adminSB() {
  return createSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: string
    doubtId?: string
    moduleId?: string
    questionText?: string
    answerText?: string
  }
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

  // ── Post an answer (teacher/admin only — enforced by role check) ─
  if (body.action === 'post_answer') {
    if (!body.doubtId || !body.answerText?.trim())
      return NextResponse.json({ error: 'doubtId and answerText required' }, { status: 400 })

    const { error: ae } = await sb.from('doubt_answers').insert({
      doubt_id:    body.doubtId,
      answered_by: user.id,
      answer_text: body.answerText.trim(),
    })
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 })

    // Mark resolved
    await sb.from('doubts').update({ is_resolved: true }).eq('id', body.doubtId)
    return NextResponse.json({ success: true })
  }

  // ── Upvote (atomic) ─────────────────────────────────────────
  if (body.action === 'upvote') {
    if (!body.doubtId) return NextResponse.json({ error: 'doubtId required' }, { status: 400 })
    const { data } = await sb.from('doubts').select('upvotes').eq('id', body.doubtId).single()
    const cur = (data as { upvotes: number } | null)?.upvotes ?? 0
    await sb.from('doubts').update({ upvotes: cur + 1 }).eq('id', body.doubtId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
