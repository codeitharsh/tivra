// Single source of truth for "what fraction of this subject's topics
// has a student completed" — computed dynamically from real row counts
// every time, matching the exact pattern established in
// src/lib/course-progress.ts. Free Notes has no "required vs optional"
// concept (unlike self-paced course lessons) — every topic counts.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SubjectProgress {
  total: number
  completed: number
  percent: number
  completedNoteIds: Set<string>
}

const EMPTY: SubjectProgress = { total: 0, completed: 0, percent: 0, completedNoteIds: new Set() }

export async function getSubjectProgress(
  sb: SupabaseClient,
  studentId: string,
  subjectId: string
): Promise<SubjectProgress> {
  const { data: unitsRaw } = await sb
    .from('units')
    .select('id')
    .eq('subject_id', subjectId)

  const unitIds = ((unitsRaw ?? []) as { id: string }[]).map(u => u.id)
  if (unitIds.length === 0) return EMPTY

  const { data: notesRaw } = await sb
    .from('free_notes')
    .select('id')
    .in('unit_id', unitIds)

  const noteIds = ((notesRaw ?? []) as { id: string }[]).map(n => n.id)
  const total = noteIds.length
  if (total === 0) return EMPTY

  const { data: progressRaw } = await sb
    .from('free_note_progress')
    .select('note_id')
    .eq('student_id', studentId)
    .in('note_id', noteIds)

  const completedNoteIds = new Set(
    ((progressRaw ?? []) as { note_id: string }[]).map(p => p.note_id)
  )
  const completed = completedNoteIds.size
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  return { total, completed, percent, completedNoteIds }
}
