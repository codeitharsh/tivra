export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSB } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSubjectProgress } from '@/lib/free-notes-progress'

// Deliberately untyped — units/free_notes/free_note_progress aren't
// declared in src/types/database.ts, same gap as course_* tables (see
// src/app/api/course-progress/route.ts for the identical reasoning).
function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const admin = adminSB()

    // ── MARK TOPIC COMPLETE — re-derives student_id from the session
    //    (never the request body), validates the topic actually belongs
    //    to an active subject before recording anything. Runs on the
    //    service-role client because free_note_progress has no client
    //    insert policy at all (see the migration). No certificate/
    //    completion concept here, unlike self-paced courses — just the
    //    checkbox and the recomputed percent. ─────────────────────────
    if (body.action === 'mark_topic_complete') {
      const { noteId } = body as { noteId?: string }
      if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

      const { data: noteRow } = await admin
        .from('free_notes')
        .select('id, unit_id, units!unit_id(subject_id, subjects!subject_id(id, is_active))')
        .eq('id', noteId)
        .maybeSingle()

      if (!noteRow) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

      // Supabase's to-one join can come back as an object or a
      // single-element array depending on relationship inference —
      // handled defensively since this directly gates a write.
      type SubjectJoin = { id: string; is_active: boolean } | { id: string; is_active: boolean }[] | null
      type UnitJoin = { subject_id: string; subjects: SubjectJoin } | { subject_id: string; subjects: SubjectJoin }[] | null
      const unitJoinRaw = (noteRow as { units: UnitJoin }).units
      const unitJoin = Array.isArray(unitJoinRaw) ? unitJoinRaw[0] : unitJoinRaw
      const subjectJoinRaw = unitJoin?.subjects
      const subjectJoin = Array.isArray(subjectJoinRaw) ? subjectJoinRaw[0] : subjectJoinRaw

      if (!subjectJoin || !subjectJoin.is_active) {
        return NextResponse.json({ error: 'This topic is not currently available' }, { status: 404 })
      }
      const subjectId = subjectJoin.id

      const { error: insertError } = await admin.from('free_note_progress').upsert({
        student_id: user.id, note_id: noteId,
      }, { onConflict: 'student_id,note_id', ignoreDuplicates: true })

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

      const progress = await getSubjectProgress(admin, user.id, subjectId)
      return NextResponse.json({ success: true, progress })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[free-notes-progress] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
