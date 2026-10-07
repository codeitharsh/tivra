export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { CourseBlock } from '@/types/course'

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

// Content blocks are admin-authored (is_staff()-gated), but still worth a
// shape check server-side — this is the one write path where a malformed
// payload could otherwise wedge a lesson's renderer.
function validateContent(content: unknown): content is CourseBlock[] {
  if (!Array.isArray(content) || content.length > 300) return false
  return content.every(b =>
    b && typeof b === 'object' && typeof (b as { id?: unknown }).id === 'string'
    && typeof (b as { type?: unknown }).type === 'string'
  )
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireStaff()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const sb = adminSB()

    // ── COURSES ──────────────────────────────────────────────
    if (body.action === 'create_course') {
      const { title, description, difficulty, estimatedDurationMinutes, skills, learningOutcomes, priceInr, originalPriceInr, trackSlug } = body as {
        title?: string; description?: string; difficulty?: string
        estimatedDurationMinutes?: number; skills?: string; learningOutcomes?: string
        priceInr?: number; originalPriceInr?: number; trackSlug?: string
      }
      const trimmedTitle = title?.trim()
      if (!trimmedTitle) return NextResponse.json({ error: 'Course title is required' }, { status: 400 })

      const slug = slugify(trimmedTitle)
      if (!slug) return NextResponse.json({ error: 'Could not derive a valid slug from that title' }, { status: 400 })

      const { data, error } = await sb.from('courses').insert({
        title: trimmedTitle, slug,
        description: description?.trim() || null,
        difficulty: difficulty && ['beginner', 'intermediate', 'advanced'].includes(difficulty) ? difficulty : 'beginner',
        estimated_duration_minutes: estimatedDurationMinutes || null,
        skills: toArray(skills),
        learning_outcomes: toArray(learningOutcomes),
        price_inr: priceInr || null,
        original_price_inr: originalPriceInr || null,
        track_slug: trackSlug?.trim() || null,
        created_by: user.id,
      }).select('id, slug').single()

      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: `A course with slug "${slug}" already exists` }, { status: 409 })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, id: data.id, slug: data.slug })
    }

    if (body.action === 'update_course') {
      const { courseId, title, description, difficulty, estimatedDurationMinutes, skills, learningOutcomes, status, isCertificateEnabled, displayOrder, priceInr, originalPriceInr, trackSlug } = body as {
        courseId?: string; title?: string; description?: string; difficulty?: string
        estimatedDurationMinutes?: number; skills?: string; learningOutcomes?: string
        status?: string; isCertificateEnabled?: boolean; displayOrder?: number
        priceInr?: number | null; originalPriceInr?: number | null; trackSlug?: string | null
      }
      if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title !== undefined)           updates.title = title.trim()
      if (description !== undefined)     updates.description = description.trim() || null
      if (difficulty !== undefined && ['beginner', 'intermediate', 'advanced'].includes(difficulty)) updates.difficulty = difficulty
      if (estimatedDurationMinutes !== undefined) updates.estimated_duration_minutes = estimatedDurationMinutes || null
      if (skills !== undefined)          updates.skills = toArray(skills)
      if (learningOutcomes !== undefined) updates.learning_outcomes = toArray(learningOutcomes)
      if (status !== undefined && ['draft', 'review', 'published', 'archived'].includes(status)) updates.status = status
      if (isCertificateEnabled !== undefined) updates.is_certificate_enabled = isCertificateEnabled
      if (displayOrder !== undefined)    updates.display_order = displayOrder
      if (priceInr !== undefined)        updates.price_inr = priceInr || null
      if (originalPriceInr !== undefined) updates.original_price_inr = originalPriceInr || null
      if (trackSlug !== undefined)       updates.track_slug = trackSlug?.trim() || null

      const { error } = await sb.from('courses').update(updates).eq('id', courseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete_course') {
      const { courseId } = body as { courseId?: string }
      if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

      // Best-effort: remove any uploaded images for this course before
      // the cascade delete removes the rows that reference them.
      const { data: files } = await sb.storage.from('course-assets').list(courseId)
      if (files && files.length > 0) {
        await sb.storage.from('course-assets').remove(files.map(f => `${courseId}/${f.name}`))
      }

      const { error } = await sb.from('courses').delete().eq('id', courseId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── MIGRATION: seed a draft course from an existing live programme ──
    // Purely additive — only ever inserts new `courses`/`course_modules`/
    // `course_lessons` rows; never reads back results into, writes to, or
    // deletes anything in `programs`/`phases`/`modules`. The created
    // course always lands in 'draft' so nothing becomes customer-facing
    // as a side effect of running this.
    if (body.action === 'seed_from_program') {
      const { programId } = body as { programId?: string }
      if (!programId) return NextResponse.json({ error: 'programId required' }, { status: 400 })

      const { data: programRow } = await sb
        .from('programs')
        .select('id, name, description, tagline, difficulty')
        .eq('id', programId)
        .maybeSingle()
      if (!programRow) return NextResponse.json({ error: 'Programme not found' }, { status: 404 })
      const program = programRow as {
        id: string; name: string; description: string | null
        tagline: string | null; difficulty: string | null
      }

      const { data: phasesRaw } = await sb
        .from('phases')
        .select('id, title, phase_number')
        .eq('program_id', programId)
        .order('phase_number')
      const phases = (phasesRaw ?? []) as { id: string; title: string; phase_number: number }[]

      const phaseIds = phases.map(p => p.id)
      const { data: modulesRaw } = phaseIds.length > 0 ? await sb
        .from('modules')
        .select('id, phase_id, title, module_number, notes_url')
        .in('phase_id', phaseIds)
        .order('module_number') : { data: [] }
      const modules = (modulesRaw ?? []) as {
        id: string; phase_id: string; title: string; module_number: number; notes_url: string | null
      }[]

      // Slug collision is expected on a re-run (or if a course with a
      // matching name already exists) — append a short suffix rather
      // than failing the whole migration.
      const baseSlug = slugify(program.name) || 'programme-course'
      let slug = baseSlug
      let courseId: string | null = null
      for (let attempt = 0; attempt < 5 && !courseId; attempt++) {
        const { data: created, error: createErr } = await sb.from('courses').insert({
          title: program.name,
          slug,
          description: program.description?.trim() || program.tagline?.trim() || null,
          difficulty: program.difficulty && ['beginner', 'intermediate', 'advanced'].includes(program.difficulty) ? program.difficulty : 'beginner',
          status: 'draft',
          created_by: user.id,
        }).select('id').single()

        if (!createErr && created) { courseId = created.id; break }
        if (createErr?.code === '23505') { slug = `${baseSlug}-${attempt + 2}`; continue }
        if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
      }
      if (!courseId) return NextResponse.json({ error: 'Could not find an available slug for this programme' }, { status: 500 })

      for (const phase of phases) {
        const { data: createdModule, error: modErr } = await sb.from('course_modules').insert({
          course_id: courseId, title: phase.title, module_number: phase.phase_number,
        }).select('id').single()
        if (modErr) return NextResponse.json({ error: `Failed creating module for phase "${phase.title}": ${modErr.message}` }, { status: 500 })

        const phaseModules = modules.filter(m => m.phase_id === phase.id)
        for (const mod of phaseModules) {
          const content = mod.notes_url
            ? [{ id: crypto.randomUUID(), type: 'pdf', path: mod.notes_url, title: `${mod.title} Notes` }]
            : []
          const { error: lessonErr } = await sb.from('course_lessons').insert({
            module_id: createdModule.id, title: mod.title, lesson_number: mod.module_number,
            estimated_duration_minutes: 15, is_required: true, content,
          })
          if (lessonErr) return NextResponse.json({ error: `Failed creating lesson "${mod.title}": ${lessonErr.message}` }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, courseId, slug })
    }

    // ── MODULES ──────────────────────────────────────────────
    if (body.action === 'create_module') {
      const { courseId, title } = body as { courseId?: string; title?: string }
      if (!courseId || !title?.trim()) return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 })

      const { data: existing } = await sb.from('course_modules').select('module_number').eq('course_id', courseId).order('module_number', { ascending: false }).limit(1)
      const nextNumber = ((existing?.[0] as { module_number: number } | undefined)?.module_number ?? 0) + 1

      const { data, error } = await sb.from('course_modules').insert({
        course_id: courseId, title: title.trim(), module_number: nextNumber,
      }).select('id').single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, id: data.id })
    }

    if (body.action === 'update_module') {
      const { moduleId, title } = body as { moduleId?: string; title?: string }
      if (!moduleId || !title?.trim()) return NextResponse.json({ error: 'moduleId and title are required' }, { status: 400 })
      const { error } = await sb.from('course_modules').update({ title: title.trim() }).eq('id', moduleId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete_module') {
      const { moduleId } = body as { moduleId?: string }
      if (!moduleId) return NextResponse.json({ error: 'moduleId required' }, { status: 400 })
      const { error } = await sb.from('course_modules').delete().eq('id', moduleId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'reorder_module') {
      const { moduleId1, order1, moduleId2, order2 } = body as { moduleId1?: string; order1?: number; moduleId2?: string; order2?: number }
      if (!moduleId1 || !moduleId2) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const n1 = Number(order1), n2 = Number(order2)
      if (!Number.isInteger(n1) || n1 < 1 || !Number.isInteger(n2) || n2 < 1) {
        return NextResponse.json({ error: 'order1/order2 must be positive integers' }, { status: 400 })
      }
      // Same temporary-sentinel swap as /api/curriculum's swap_module_order —
      // course_modules has an identical unique(course_id, module_number)
      // constraint that a direct two-step swap would collide against.
      const { error: eTmp } = await sb.from('course_modules').update({ module_number: -1 }).eq('id', moduleId1)
      if (eTmp) return NextResponse.json({ error: eTmp.message }, { status: 500 })
      const { error: e2 } = await sb.from('course_modules').update({ module_number: n2 }).eq('id', moduleId2)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      const { error: e1 } = await sb.from('course_modules').update({ module_number: n1 }).eq('id', moduleId1)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── LESSONS ──────────────────────────────────────────────
    if (body.action === 'create_lesson') {
      const { moduleId, title, estimatedDurationMinutes, isRequired } = body as {
        moduleId?: string; title?: string; estimatedDurationMinutes?: number; isRequired?: boolean
      }
      if (!moduleId || !title?.trim()) return NextResponse.json({ error: 'moduleId and title are required' }, { status: 400 })

      const { data: existing } = await sb.from('course_lessons').select('lesson_number').eq('module_id', moduleId).order('lesson_number', { ascending: false }).limit(1)
      const nextNumber = ((existing?.[0] as { lesson_number: number } | undefined)?.lesson_number ?? 0) + 1

      const { data, error } = await sb.from('course_lessons').insert({
        module_id: moduleId, title: title.trim(), lesson_number: nextNumber,
        estimated_duration_minutes: estimatedDurationMinutes || 5,
        is_required: isRequired !== false,
        content: [],
      }).select('id').single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, id: data.id })
    }

    if (body.action === 'update_lesson_meta') {
      const { lessonId, title, estimatedDurationMinutes, isRequired } = body as {
        lessonId?: string; title?: string; estimatedDurationMinutes?: number; isRequired?: boolean
      }
      if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title !== undefined) updates.title = title.trim()
      if (estimatedDurationMinutes !== undefined) updates.estimated_duration_minutes = estimatedDurationMinutes
      if (isRequired !== undefined) updates.is_required = isRequired
      const { error } = await sb.from('course_lessons').update(updates).eq('id', lessonId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete_lesson') {
      const { lessonId } = body as { lessonId?: string }
      if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
      const { error } = await sb.from('course_lessons').delete().eq('id', lessonId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'reorder_lesson') {
      const { lessonId1, order1, lessonId2, order2 } = body as { lessonId1?: string; order1?: number; lessonId2?: string; order2?: number }
      if (!lessonId1 || !lessonId2) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const n1 = Number(order1), n2 = Number(order2)
      if (!Number.isInteger(n1) || n1 < 1 || !Number.isInteger(n2) || n2 < 1) {
        return NextResponse.json({ error: 'order1/order2 must be positive integers' }, { status: 400 })
      }
      const { error: eTmp } = await sb.from('course_lessons').update({ lesson_number: -1 }).eq('id', lessonId1)
      if (eTmp) return NextResponse.json({ error: eTmp.message }, { status: 500 })
      const { error: e2 } = await sb.from('course_lessons').update({ lesson_number: n2 }).eq('id', lessonId2)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      const { error: e1 } = await sb.from('course_lessons').update({ lesson_number: n1 }).eq('id', lessonId1)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'update_lesson_content') {
      const { lessonId, content } = body as { lessonId?: string; content?: unknown }
      if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
      if (!validateContent(content)) return NextResponse.json({ error: 'Invalid content payload' }, { status: 400 })

      const { error } = await sb.from('course_lessons').update({
        content, updated_at: new Date().toISOString(),
      }).eq('id', lessonId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── QUIZZES ──────────────────────────────────────────────
    if (body.action === 'create_quiz') {
      const { courseId, title, quizType, moduleId, passingPercent } = body as {
        courseId?: string; title?: string; quizType?: string; moduleId?: string | null; passingPercent?: number
      }
      if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })
      if (quizType !== 'module_test' && quizType !== 'final_assessment') {
        return NextResponse.json({ error: 'quizType must be module_test or final_assessment' }, { status: 400 })
      }
      if (quizType === 'module_test' && !moduleId) {
        return NextResponse.json({ error: 'moduleId required for a module test' }, { status: 400 })
      }

      const { data, error } = await sb.from('course_quizzes').insert({
        course_id: courseId,
        title: title?.trim() || (quizType === 'final_assessment' ? 'Final Assessment' : 'Module Test'),
        quiz_type: quizType,
        module_id: quizType === 'module_test' ? moduleId : null,
        passing_percent: passingPercent || 70,
      }).select('id').single()

      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'A quiz already exists for this course/module' }, { status: 409 })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, id: data.id })
    }

    if (body.action === 'update_quiz') {
      const { quizId, title, passingPercent } = body as { quizId?: string; title?: string; passingPercent?: number }
      if (!quizId) return NextResponse.json({ error: 'quizId required' }, { status: 400 })
      const updates: Record<string, unknown> = {}
      if (title !== undefined) updates.title = title.trim()
      if (passingPercent !== undefined) updates.passing_percent = passingPercent
      const { error } = await sb.from('course_quizzes').update(updates).eq('id', quizId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete_quiz') {
      const { quizId } = body as { quizId?: string }
      if (!quizId) return NextResponse.json({ error: 'quizId required' }, { status: 400 })
      const { error } = await sb.from('course_quizzes').delete().eq('id', quizId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── QUIZ QUESTIONS ───────────────────────────────────────
    if (body.action === 'create_quiz_question') {
      const { quizId, questionText, options, correctAnswer, explanation } = body as {
        quizId?: string; questionText?: string; options?: string[]; correctAnswer?: string; explanation?: string
      }
      if (!quizId || !questionText?.trim()) return NextResponse.json({ error: 'quizId and questionText are required' }, { status: 400 })
      if (!Array.isArray(options) || options.length < 2 || options.some(o => !o?.trim())) {
        return NextResponse.json({ error: 'At least 2 non-empty options are required' }, { status: 400 })
      }
      if (!correctAnswer || !options.includes(correctAnswer)) {
        return NextResponse.json({ error: 'correctAnswer must match one of the options' }, { status: 400 })
      }

      const { data: existing } = await sb.from('course_quiz_questions').select('order_num').eq('quiz_id', quizId).order('order_num', { ascending: false }).limit(1)
      const nextOrder = ((existing?.[0] as { order_num: number } | undefined)?.order_num ?? 0) + 1

      const { data, error } = await sb.from('course_quiz_questions').insert({
        quiz_id: quizId,
        question_text: questionText.trim(),
        options,
        correct_answer: correctAnswer,
        explanation: explanation?.trim() || null,
        order_num: nextOrder,
      }).select('id').single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, id: data.id })
    }

    if (body.action === 'delete_quiz_question') {
      const { questionId } = body as { questionId?: string }
      if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })
      const { error } = await sb.from('course_quiz_questions').delete().eq('id', questionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('[admin/courses] Unexpected error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unexpected server error',
    }, { status: 500 })
  }
}
