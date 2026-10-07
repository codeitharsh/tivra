export const runtime = 'edge'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import { requireActiveStudent } from '@/lib/access-gate'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'
import WhatsAppBanner from '@/components/WhatsAppBanner'
import type { Profile } from '@/types/database'
import { PROGRAM_META, DEFAULT_PROGRAM_META } from '@/lib/program-meta'
import { getCourseProgress } from '@/lib/course-progress'
import CourseCard, { type CourseCardData } from '@/components/course/CourseCard'
import {
  BookOpen, ClipboardList, Target, Award, Flame, Video, Radio,
  TrendingUp, CreditCard, Trophy, Lock, CheckCircle2, ArrowRight,
  GraduationCap, Compass,
} from 'lucide-react'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ banner?: string }>
}) {
  const supabase = await createClient()
  const params   = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profileData) redirect('/login')
  const p = profileData as Profile

  // ── Role-based redirect ───────────────────────────────────
  if (p.role === 'admin')   redirect('/admin')
  if (p.role === 'teacher') redirect('/teacher')

  // ── Hard access gate — defense in depth ───────────────────
  requireActiveStudent(p)

  const isPending    = p.access_status === 'pending_payment'
  const showPayBanner = isPending || params.banner === 'payment_required'

  const admin = createAdminClient()

  // ── Resolve the student's actual enrolled programmes ──────
  // Uses adminClient (service role) instead of the anon supabase client
  // because RLS policies on enrolled_programs or the programs join can
  // silently return empty results for a valid student — the service
  // role bypasses RLS entirely, which is safe here since we already
  // verified the user's identity and are only reading their own rows
  // (filtered by user.id). Without this, the join to programs returns
  // null even when the enrolled_programs row exists, causing the
  // "No programme enrollment found" banner to show incorrectly.
  const { data: enrolledRaw } = await admin
    .from('enrolled_programs')
    .select('programs!program_id(id, name, slug)')
    .eq('student_id', user.id)

  // Same Supabase to-one-join shape ambiguity flagged in
  // my-programs/route.ts and program-completion.ts — handled
  // defensively here too even though tsc didn't flag this particular
  // call site, since the underlying runtime ambiguity is identical and
  // a wrong shape here would silently show the wrong enrolled
  // programmes on a student's own dashboard.
  type EnrolledRow = { programs: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }
  const enrolledProgramsList = ((enrolledRaw ?? []) as unknown as EnrolledRow[])
    .map(e => Array.isArray(e.programs) ? (e.programs[0] ?? null) : e.programs)
    .filter((pr): pr is { id: string; name: string; slug: string } => !!pr)

  const enrolledProgramIds = enrolledProgramsList.map(pr => pr.id)
  const slugByProgramId = new Map(enrolledProgramsList.map(pr => [pr.id, pr.slug]))

  // ── Stats ────────────────────────────────────────────────
  const [
    { count: completedModules },
    { data: attemptsRaw },
    { data: assessAttemptsRaw },
    { data: certsRaw },
  ] = await Promise.all([
    admin.from('module_progress').select('*',{count:'exact',head:true})
      .eq('student_id', user.id).eq('status','completed'),
    admin.from('test_attempts').select('score_percent').eq('student_id', user.id),
    admin.from('assessment_attempts').select('score_percent,passed,assessment_id')
      .eq('student_id', user.id).order('submitted_at',{ascending:false}),
    admin.from('certificates').select('phase_id').eq('student_id', user.id).eq('is_revoked',false),
  ])

  const attempts   = (attemptsRaw ?? []) as { score_percent: number }[]
  const testsTaken = attempts.length
  const avgScore   = testsTaken > 0
    ? Math.round(attempts.reduce((s,a) => s + (a.score_percent??0), 0) / testsTaken)
    : 0

  const modulesCompleted = completedModules ?? 0

  // Total module count across ONLY the student's enrolled programmes —
  // previously hardcoded as a literal /24, which was only ever correct
  // for the original single-programme, 2-phase, 24-module Cloud
  // LaunchPad. Computed dynamically now so it stays correct regardless
  // of which programme(s) a student is in or how many modules any
  // given programme has.
  let totalModulesAcrossEnrolled = 0
  if (enrolledProgramIds.length > 0) {
    const { data: phaseIdsRaw } = await admin
      .from('phases')
      .select('id')
      .in('program_id', enrolledProgramIds)
    const phaseIds = ((phaseIdsRaw ?? []) as { id: string }[]).map(ph => ph.id)
    if (phaseIds.length > 0) {
      const { count } = await admin
        .from('modules')
        .select('*', { count: 'exact', head: true })
        .in('phase_id', phaseIds)
      totalModulesAcrossEnrolled = count ?? 0
    }
  }
  const progress = totalModulesAcrossEnrolled > 0
    ? Math.round((modulesCompleted / totalModulesAcrossEnrolled) * 100)
    : 0

  const streak = p.streak_count ?? 0
  const certs  = (certsRaw ?? []) as { phase_id: string }[]

  const now = new Date()

  // ── Upcoming tests — scoped to enrolled programmes only ───
  let upcomingTests: {
    id: string; title: string; topic: string|null; week_number: number
    duration_minutes: number; is_manually_unlocked: boolean; unlock_datetime: string|null
    isOpen: boolean; isUpcoming: boolean | null; unlockDt: Date | null
    slug: string
  }[] = []

  if (enrolledProgramIds.length > 0) {
    const { data: upcomingTestsRaw } = await admin
      .from('weekly_tests')
      .select('id, title, topic, week_number, unlock_datetime, duration_minutes, is_manually_unlocked, program_id')
      .in('program_id', enrolledProgramIds)
      .order('unlock_datetime')
      .limit(20)

    const { data: attemptsWithId } = await admin
      .from('test_attempts').select('test_id').eq('student_id', user.id)
    const takenIds = new Set(((attemptsWithId??[]) as {test_id:string}[]).map(a => a.test_id))

    upcomingTests = ((upcomingTestsRaw ?? []) as Record<string,unknown>[])
      .filter(t => !takenIds.has(t.id as string))
      .map(t => {
        const unlockDt   = t.unlock_datetime ? new Date(t.unlock_datetime as string) : null
        const isOpen     = !!(t.is_manually_unlocked) || (unlockDt ? now >= unlockDt : false)
        const isUpcoming = !isOpen && unlockDt && unlockDt > now
        return {
          id:                   t.id as string,
          title:                t.title as string,
          topic:                t.topic as string|null,
          week_number:          t.week_number as number,
          duration_minutes:     t.duration_minutes as number,
          is_manually_unlocked: t.is_manually_unlocked as boolean,
          unlock_datetime:      t.unlock_datetime as string|null,
          isOpen, isUpcoming, unlockDt,
          slug: slugByProgramId.get(t.program_id as string) ?? '',
        }
      })
      .filter(t => t.isOpen || t.isUpcoming)
      .slice(0, 3)
  }

  // ── Upcoming live sessions ────────────────────────────────
  const { data: sessionsRaw } = await admin
    .from('live_sessions')
    .select('id, title, scheduled_at, duration_minutes, is_live')
    .eq('is_completed', false)
    .gte('scheduled_at', now.toISOString())
    .order('scheduled_at')
    .limit(2)

  const sessions = (sessionsRaw ?? []) as Record<string,unknown>[]

  // ── Phase assessment status — scoped to enrolled programmes ──
  let phaseStatus: {
    phase: { id:string; title:string; phase_number:number; program_id: string }
    assessment: Record<string,unknown> | undefined
    hasCert: boolean; allDone: boolean; scheduleOk: boolean
    statusLabel: string; statusColor: string
    aId: string | undefined; doneCount: number; total: number
    slug: string
  }[] = []

  if (enrolledProgramIds.length > 0) {
    const { data: phasesRaw } = await admin
      .from('phases')
      .select('id, title, phase_number, program_id, modules(id)')
      .in('program_id', enrolledProgramIds)
      .order('phase_number')
    const phases = (phasesRaw ?? []) as { id:string; title:string; phase_number:number; program_id: string; modules:{id:string}[] }[]

    const { data: assessmentsRaw } = await admin
      .from('assessments')
      .select('id, phase_id, passing_percent, is_manually_unlocked, unlock_datetime')
      .in('phase_id', phases.map(ph=>ph.id))
    const assessments = (assessmentsRaw ?? []) as Record<string,unknown>[]

    const { data: progressRows } = await admin
      .from('module_progress').select('module_id').eq('student_id',user.id).eq('status','completed')
    const completedModuleIds = new Set(
      ((progressRows ?? []) as Record<string,unknown>[]).map(m => m.module_id as string)
    )
    const assessAttempts = (assessAttemptsRaw ?? []) as {score_percent:number; passed:boolean; assessment_id:string}[]

    phaseStatus = phases.map(phase => {
      const phaseModuleIds  = phase.modules.map(m=>m.id)
      const doneCount       = phaseModuleIds.filter(id => completedModuleIds.has(id)).length
      const allDone         = doneCount === phaseModuleIds.length && phaseModuleIds.length > 0
      const assessment      = assessments.find(a => a.phase_id === phase.id)
      const aId             = assessment?.id as string|undefined
      const latestAttempt   = aId ? assessAttempts.find(a => a.assessment_id === aId) : null
      const hasCert         = certs.some(c => c.phase_id === phase.id)
      const scheduleOk      = !!(assessment?.is_manually_unlocked) ||
        (assessment?.unlock_datetime ? now >= new Date(assessment.unlock_datetime as string) : false)

      let statusLabel = ''
      let statusColor = ''
      if (hasCert) { statusLabel = '🏆 Certificate earned'; statusColor = 'var(--green)' }
      else if (latestAttempt && !latestAttempt.passed) { statusLabel = `${Math.round(latestAttempt.score_percent)}% — retake available`; statusColor = 'var(--amber)' }
      else if (!assessment) { statusLabel = 'Assessment not set up'; statusColor = 'var(--muted)' }
      else if (!allDone)    { statusLabel = `${doneCount}/${phaseModuleIds.length} modules done`; statusColor = 'var(--muted)' }
      else if (!scheduleOk) { statusLabel = 'Waiting for admin to unlock'; statusColor = 'var(--amber)' }
      else                  { statusLabel = '✓ Ready to take'; statusColor = 'var(--cyan)' }

      return {
        phase, assessment, hasCert, allDone, scheduleOk, statusLabel, statusColor, aId, doneCount,
        total: phaseModuleIds.length,
        slug: slugByProgramId.get(phase.program_id) ?? '',
      }
    })
  }

  const streakDots = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7))

  // Used for the top-level "All tests →" / "View all →" links — points
  // at the first enrolled programme if there's exactly one, otherwise
  // falls back to nothing (a flat dashboard has no single obvious
  // destination once 2+ programmes are involved — individual cards
  // below still link correctly to their own programme).
  const primarySlug = enrolledProgramsList.length === 1 ? enrolledProgramsList[0].slug : null

  // ── Self-paced dashboard data — only fetched when this student has no
  // active cohort enrollment. Per the confirmed "finish out their cohort"
  // decision, a currently-enrolled cohort student keeps seeing exactly
  // today's dashboard (the branch above, byte-for-byte unchanged); this
  // is the Coursera/Udemy-style replacement for everyone else, naturally
  // taking over on its own as cohorts complete with no further code
  // change needed later.
  type MyCourse = { course: CourseCardData; percent: number; started: boolean }
  let myCourses: MyCourse[] = []
  let overallPercent = 0
  let certificatesList: { id: string; courseTitle: string; issuedAt: string }[] = []
  let recommendedCourses: CourseCardData[] = []

  const COURSE_CARD_FIELDS = 'id, slug, title, description, difficulty, estimated_duration_minutes, skills, cover_image_path, price_inr, original_price_inr, status'

  if (enrolledProgramIds.length === 0) {
    const [{ data: courseEnrollRaw }, { data: coursePurchasesRaw }, { data: pathPurchasesRaw }] = await Promise.all([
      admin.from('course_enrollments').select('course_id, last_lesson_id').eq('student_id', user.id),
      admin.from('course_purchases').select('course_id').eq('student_id', user.id),
      admin.from('career_path_purchases').select('career_path_id').eq('student_id', user.id),
    ])

    const enrollMap = new Map(
      ((courseEnrollRaw ?? []) as { course_id: string; last_lesson_id: string | null }[]).map(e => [e.course_id, e.last_lesson_id])
    )
    const purchasedCourseIds = ((coursePurchasesRaw ?? []) as { course_id: string }[]).map(p => p.course_id)
    const pathIds = ((pathPurchasesRaw ?? []) as { career_path_id: string }[]).map(p => p.career_path_id)

    let bundleCourseIds: string[] = []
    if (pathIds.length > 0) {
      const { data: bundleLinksRaw } = await admin
        .from('career_path_courses').select('course_id').in('career_path_id', pathIds)
      bundleCourseIds = ((bundleLinksRaw ?? []) as { course_id: string }[]).map(l => l.course_id)
    }

    // "My Courses" is every course this student has access to — started,
    // bought individually, or granted via a career-path bundle — not
    // just the ones they've already clicked into.
    const accessibleCourseIds = Array.from(new Set([
      ...enrollMap.keys(), ...purchasedCourseIds, ...bundleCourseIds,
    ]))

    const { data: accessibleCoursesRaw } = accessibleCourseIds.length > 0 ? await admin
      .from('courses').select(COURSE_CARD_FIELDS).in('id', accessibleCourseIds) : { data: [] }
    const accessibleCourses = ((accessibleCoursesRaw ?? []) as (CourseCardData & { status: string })[])
      .filter(c => c.status === 'published')

    const progressList = await Promise.all(accessibleCourses.map(c => getCourseProgress(admin, user.id, c.id)))

    myCourses = accessibleCourses
      .map((c, i) => ({
        course: c, percent: progressList[i].percent, started: enrollMap.has(c.id),
      }))
      .sort((a, b) => {
        // In-progress courses first (most actionable), then not-started,
        // then fully completed — so "continue learning" is always what a
        // student sees first.
        const rank = (x: MyCourse) => (x.percent > 0 && x.percent < 100) ? 0 : x.percent === 0 ? 1 : 2
        return rank(a) - rank(b)
      })

    overallPercent = myCourses.length > 0
      ? Math.round(myCourses.reduce((s, c) => s + c.percent, 0) / myCourses.length)
      : 0

    const { data: completionsRaw } = await admin
      .from('course_completions')
      .select('id, course_id, issued_at, courses!course_id(title)')
      .eq('student_id', user.id).eq('is_revoked', false)
      .order('issued_at', { ascending: false })

    type CompletionRow = { id: string; course_id: string; issued_at: string; courses: { title: string } | { title: string }[] | null }
    certificatesList = ((completionsRaw ?? []) as CompletionRow[]).map(c => {
      const course = Array.isArray(c.courses) ? (c.courses[0] ?? null) : c.courses
      return { id: c.id, courseTitle: course?.title ?? 'Course', issuedAt: c.issued_at }
    })

    const { data: recommendedRaw } = await admin
      .from('courses').select(COURSE_CARD_FIELDS)
      .eq('status', 'published').order('display_order').limit(20)
    const accessibleSet = new Set(accessibleCourseIds)
    recommendedCourses = ((recommendedRaw ?? []) as (CourseCardData & { status: string })[])
      .filter(c => !accessibleSet.has(c.id))
      .slice(0, 3)
  }

  if (enrolledProgramsList.length === 0) {
    return (
      <AuthShell profile={p} title="Dashboard" subtitle={`Welcome back, ${p.full_name?.split(' ')[0] ?? 'Student'}`}>
        {showPayBanner && (
          <div className="banner banner-warning">
            <CreditCard size={18} style={{ flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              {ENROLLMENT_OPEN ? (
                <><strong>Payment pending.</strong> Submit your payment details so our team can activate your account. Usually done within 24 hours.</>
              ) : (
                <><strong>New programme enrollment is closed.</strong> Explore our self-paced courses and career paths instead.</>
              )}
            </div>
            {ENROLLMENT_OPEN ? (
              <Link href="/payment" className="btn btn-primary"
                style={{ fontSize:'12px', padding:'8px 16px', flexShrink:0 }}>
                Submit Payment <ArrowRight size={13}/>
              </Link>
            ) : (
              <Link href="/explore" className="btn btn-primary"
                style={{ fontSize:'12px', padding:'8px 16px', flexShrink:0 }}>
                Explore Courses <ArrowRight size={13}/>
              </Link>
            )}
          </div>
        )}

        <div className="r-grid-4" style={{ marginBottom:'20px' }}>
          {[
            { label:'Overall progress',     value:`${overallPercent}%`, color:'var(--accent)',   bar:overallPercent, icon:TrendingUp },
            { label:'Courses in progress',  value:String(myCourses.filter(c => c.percent > 0 && c.percent < 100).length), color:'var(--accent-2)', bar:null, icon:BookOpen },
            { label:'Courses completed',    value:String(myCourses.filter(c => c.percent === 100).length), color:'var(--green)', bar:null, icon:Trophy },
            { label:'Streak',               value:String(streak), color:'var(--amber)', bar:null, sub:'Days in a row', icon:Flame },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <div className="stat-label" style={{ marginBottom:0 }}>{s.label}</div>
                <s.icon size={14} color="var(--muted2)"/>
              </div>
              <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
              {s.bar !== null && s.bar !== undefined && (
                <div className="progress-track" style={{ marginTop:'10px' }}>
                  <div className="progress-fill" style={{ width:`${s.bar}%`, background:s.color }}/>
                </div>
              )}
              {s.sub && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <span style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px' }}>My Courses</span>
            <Link href="/explore" style={{ fontSize:'11px', color:'var(--accent-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
              EXPLORE MORE →
            </Link>
          </div>

          {myCourses.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <GraduationCap size={26} color="var(--muted2)" style={{ marginBottom:'10px' }}/>
              <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'14px' }}>
                You haven&apos;t started a course yet.
              </div>
              <Link href="/explore" className="btn btn-primary" style={{ fontSize:'13px' }}>
                <Compass size={13}/> Explore courses
              </Link>
            </div>
          ) : (
            <div className="r-grid-3">
              {myCourses.map(c => (
                <CourseCard key={c.course.id} course={c.course} progressPercent={c.percent} enrolled={c.started}/>
              ))}
            </div>
          )}
        </div>

        <div className="r-split" style={{ marginBottom:'20px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                <span style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px' }}>Certificates</span>
                {certificatesList.length > 0 && (
                  <Link href="/certificates" style={{ fontSize:'11px', color:'var(--accent-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
                    VIEW ALL →
                  </Link>
                )}
              </div>
              {certificatesList.length === 0 ? (
                <div style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'12px 0' }}>
                  Complete every required lesson in a course to earn your certificate.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {certificatesList.slice(0, 3).map(cert => (
                    <div key={cert.id} style={{
                      display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px',
                      background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
                    }}>
                      <div style={{
                        width:'28px', height:'28px', borderRadius:'6px', flexShrink:0,
                        background:'var(--green-dim)', color:'var(--green-text)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}><Award size={14}/></div>
                      <div style={{ flex:1, minWidth:0, fontSize:'13px', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {cert.courseTitle}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                <div style={{
                  width:'40px', height:'40px', borderRadius:'8px', flexShrink:0,
                  background:'var(--amber-dim)', color:'var(--amber)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Flame size={19}/>
                </div>
                <div>
                  <div className="stat-value" style={{ fontSize:'22px', color:'var(--amber)' }}>{streak}</div>
                  <div className="stat-label" style={{ marginBottom:0 }}>Day streak</div>
                </div>
              </div>
              <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'10px' }}>
                {streak >= 30 ? 'One month strong — unstoppable.'
                 : streak >= 14 ? 'Two weeks strong, keep going.'
                 : streak >= 7  ? 'A full week — nice momentum.'
                 : streak > 0   ? 'Keep it up.'
                 : 'Start your streak today.'}
              </div>
              <div style={{ display:'flex', gap:'5px' }}>
                {streakDots.map((done, i) => (
                  <div key={i} style={{
                    flex:1, height:'4px', borderRadius:'2px',
                    background: done ? 'var(--amber)' : 'rgba(0,0,0,0.08)',
                  }}/>
                ))}
              </div>
              <div style={{ fontSize:'10px', color:'var(--muted2)', marginTop:'6px', fontFamily:'var(--font-mono)' }}>
                MON – SUN THIS WEEK
              </div>
            </div>

            {recommendedCourses.length > 0 && (
              <div>
                <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px', marginBottom:'12px' }}>
                  Recommended for you
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  {recommendedCourses.map(c => <CourseCard key={c.id} course={c}/>)}
                </div>
              </div>
            )}

            <WhatsAppBanner/>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell profile={p} title="Dashboard" subtitle={`Welcome back, ${p.full_name?.split(' ')[0] ?? 'Student'}`}>
          {showPayBanner && (
            <div className="banner banner-warning">
              <CreditCard size={18} style={{ flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                {ENROLLMENT_OPEN ? (
                  <><strong>Payment pending.</strong> Submit your payment details so our team can activate your account. Usually done within 24 hours.</>
                ) : (
                  <><strong>New programme enrollment is closed.</strong> Explore our self-paced courses and career paths instead.</>
                )}
              </div>
              {ENROLLMENT_OPEN ? (
                <Link href="/payment" className="btn btn-primary"
                  style={{ fontSize:'12px', padding:'8px 16px', flexShrink:0 }}>
                  Submit Payment <ArrowRight size={13}/>
                </Link>
              ) : (
                <Link href="/explore" className="btn btn-primary"
                  style={{ fontSize:'12px', padding:'8px 16px', flexShrink:0 }}>
                  Explore Courses <ArrowRight size={13}/>
                </Link>
              )}
            </div>
          )}

          {!isPending && enrolledProgramsList.length === 0 && (
            <div className="banner banner-info">
              <BookOpen size={18} style={{ flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                No programme enrollment found on this account yet.
                If you believe this is a mistake, contact support.
              </div>
            </div>
          )}

          {/* Programme access cards — the primary navigation for enrolled students. */}
          {enrolledProgramsList.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'14px', marginBottom:'20px' }}>
              {enrolledProgramsList.map(prog => {
                const meta = PROGRAM_META[prog.slug] ?? DEFAULT_PROGRAM_META
                const Icon = meta.icon
                return (
                  <div key={prog.id} className="card card-hover" style={{ borderTop:`2px solid ${meta.color}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                      <div style={{
                        width:'28px', height:'28px', flexShrink:0, display:'flex',
                        alignItems:'center', justifyContent:'center', borderRadius:'6px',
                        background:`rgba(${meta.colorRgb},0.14)`, color:meta.color,
                      }}>
                        <Icon size={15}/>
                      </div>
                      <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px' }}>
                        {prog.name}
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      {[
                        { label:'Study Content', href:`/programs/${prog.slug}/content`,     icon:BookOpen },
                        { label:'Weekly Tests',  href:`/programs/${prog.slug}/tests`,        icon:ClipboardList },
                        { label:'Assessments',   href:`/programs/${prog.slug}/assessments`,  icon:Target },
                        { label:'Certificate',   href:`/programs/${prog.slug}/certificate`,  icon:Award },
                      ].map(link => (
                        <Link key={link.label} href={link.href} style={{ textDecoration:'none' }}>
                          <div className="module-item" style={{
                            background:'var(--card2)', border:'1px solid var(--border)',
                            color:'var(--muted)', fontWeight:500,
                          }}>
                            <link.icon size={13} style={{ flexShrink:0 }}/>
                            {link.label}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="r-grid-4" style={{ marginBottom:'20px' }}>
            {[
              { label:'Progress',     value:`${progress}%`,    color:'var(--accent)', bar:progress, icon:TrendingUp },
              { label:'Modules Done', value:`${modulesCompleted}/${totalModulesAcrossEnrolled}`, color:'var(--accent-2)', bar:null, icon:BookOpen },
              { label:'Tests Taken',  value:String(testsTaken), color:'var(--text)', bar:null, sub: testsTaken>0?`Avg ${avgScore}%`:'No tests yet', icon:ClipboardList },
              { label:'Streak',       value:String(streak),    color:'var(--amber)', bar:null, sub:'Days in a row', icon:Flame },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                  <div className="stat-label" style={{ marginBottom:0 }}>{s.label}</div>
                  <s.icon size={14} color="var(--muted2)"/>
                </div>
                <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
                {s.bar !== null && s.bar !== undefined && (
                  <div className="progress-track" style={{ marginTop:'10px' }}>
                    <div className="progress-fill" style={{ width:`${s.bar}%`, background:s.color }}/>
                  </div>
                )}
                {s.sub && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          <div className="r-split" style={{ marginBottom:'20px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              <div className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                  <span style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px' }}>Coming up</span>
                  {primarySlug && (
                    <Link href={`/programs/${primarySlug}/tests`}
                      style={{ fontSize:'11px', color:'var(--accent-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
                      ALL TESTS →
                    </Link>
                  )}
                </div>

                {isPending ? (
                  <div style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'16px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                    <Lock size={14}/> Activate your account to see upcoming tests
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {upcomingTests.length === 0 && sessions.length === 0 ? (
                      <div style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'12px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                        <CheckCircle2 size={14}/> All caught up!
                      </div>
                    ) : null}

                    {upcomingTests.map(t => (
                      <Link key={t.id}
                        href={t.isOpen ? `/programs/${t.slug}/tests/${t.id}` : `/programs/${t.slug}/tests`}
                        style={{ textDecoration:'none', display:'block' }}>
                        <div className="module-item">
                          <div className={`mod-icon ${t.isOpen ? 'mod-done' : 'mod-active'}`}>
                            <ClipboardList size={12}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:'13px', fontWeight:500 }}>
                              Week {t.week_number}: {t.topic ?? t.title}
                            </div>
                            <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                              {t.duration_minutes} min
                            </div>
                          </div>
                          <span style={{
                            fontSize:'11px', fontWeight:600, fontFamily:'var(--font-mono)',
                            color: t.isOpen ? 'var(--green)' : 'var(--amber)',
                          }}>
                            {t.isOpen ? 'OPEN →' : t.unlockDt
                              ? new Date(t.unlockDt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})
                              : 'SOON'}
                          </span>
                        </div>
                      </Link>
                    ))}

                    {sessions.map(s => (
                      <Link key={s.id as string} href={`/live/${s.id}`}
                        style={{ textDecoration:'none', display:'block' }}>
                        <div className="module-item">
                          <div className="mod-icon" style={{ background:'var(--accent-2-dim)', color:'var(--accent-2)' }}>
                            {s.is_live ? <Radio size={12}/> : <Video size={12}/>}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:'13px', fontWeight:500 }}>{String(s.title??'')}</div>
                            <div style={{ fontSize:'11px', color:'var(--muted)' }}>
                              {s.is_live ? 'Live now'
                                : new Date(s.scheduled_at as string).toLocaleString('en-IN',{
                                    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
                                  })}
                            </div>
                          </div>
                          <span style={{ fontSize:'11px', color:'var(--accent-2)', fontWeight:600, fontFamily:'var(--font-mono)' }}>
                            {s.is_live ? '● LIVE' : 'JOIN →'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                  <span style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px' }}>Phase assessments</span>
                  {primarySlug && (
                    <Link href={`/programs/${primarySlug}/assessments`}
                      style={{ fontSize:'11px', color:'var(--accent-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
                      VIEW ALL →
                    </Link>
                  )}
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {phaseStatus.length === 0 && (
                    <div style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'12px 0' }}>
                      No phase assessments to show yet.
                    </div>
                  )}
                  {phaseStatus.map(({ phase, hasCert, allDone, scheduleOk, statusLabel, statusColor, aId, doneCount, total, slug }) => {
                    const phasePct = total > 0 ? Math.round((doneCount/total)*100) : 0
                    const canStart = allDone && scheduleOk && !hasCert && !!aId

                    return (
                      <div key={phase.id} style={{
                        padding:'14px 16px', borderRadius:'var(--radius-sm)',
                        background:'var(--card2)', border:'1px solid var(--border)',
                        display:'flex', alignItems:'center', gap:'14px',
                      }}>
                        <div style={{
                          width:'34px', height:'34px', borderRadius:'6px', flexShrink:0,
                          background: hasCert ? 'var(--green-dim)' : 'rgba(0,0,0,0.06)',
                          color: hasCert ? 'var(--green)' : 'var(--muted)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          {hasCert ? <Trophy size={16}/> : <Target size={16}/>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'6px' }}>
                            Phase {phase.phase_number}: {phase.title}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                            <div className="progress-track" style={{ flex:1 }}>
                              <div className="progress-fill" style={{ width:`${phasePct}%` }}/>
                            </div>
                            <span style={{ fontSize:'11px', color:'var(--accent)', fontWeight:600, flexShrink:0, fontFamily:'var(--font-mono)' }}>
                              {phasePct}%
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:'11px', color:statusColor, fontWeight:500 }}>{statusLabel}</div>
                          {canStart && (
                            <Link href={`/programs/${slug}/assessments/${aId}`}
                              className="btn btn-primary"
                              style={{ fontSize:'11px', padding:'5px 12px', marginTop:'6px', display:'inline-flex' }}>
                              Start
                            </Link>
                          )}
                          {hasCert && (
                            <Link href={`/programs/${slug}/certificate`}
                              className="btn btn-ghost"
                              style={{ fontSize:'11px', padding:'5px 12px', marginTop:'6px', display:'inline-flex' }}>
                              View cert
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {!isPending && (
                  <div style={{ marginTop:'14px', padding:'10px 12px',
                    background:'var(--card2)', borderRadius:'var(--radius-sm)',
                    fontSize:'12px', color:'var(--muted)' }}>
                    Score ≥ 75% in a phase assessment to earn your certificate.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              <div className="card">
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                  <div style={{
                    width:'40px', height:'40px', borderRadius:'8px', flexShrink:0,
                    background:'var(--amber-dim)', color:'var(--amber)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Flame size={19}/>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize:'22px', color:'var(--amber)' }}>{streak}</div>
                    <div className="stat-label" style={{ marginBottom:0 }}>Day streak</div>
                  </div>
                </div>
                <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'10px' }}>
                  {streak >= 30 ? 'One month strong — unstoppable.'
                   : streak >= 14 ? 'Two weeks strong, keep going.'
                   : streak >= 7  ? 'A full week — nice momentum.'
                   : streak > 0   ? 'Keep it up.'
                   : 'Start your streak today.'}
                </div>
                <div style={{ display:'flex', gap:'5px' }}>
                  {streakDots.map((done, i) => (
                    <div key={i} style={{
                      flex:1, height:'4px', borderRadius:'2px',
                      background: done ? 'var(--amber)' : 'rgba(0,0,0,0.08)',
                    }}/>
                  ))}
                </div>
                <div style={{ fontSize:'10px', color:'var(--muted2)', marginTop:'6px', fontFamily:'var(--font-mono)' }}>
                  MON – SUN THIS WEEK
                </div>
              </div>

              <WhatsAppBanner/>
            </div>
          </div>
    </AuthShell>
  )
}
