import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import AssessmentManagerClient from './AssessmentManagerClient'
import type { Profile } from '@/types/database'

export default async function AdminAssessmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: phasesRaw } = await admin
    .from('phases')
    .select('id, title, phase_number')
    .order('phase_number')

  const phases = (phasesRaw ?? []) as { id: string; title: string; phase_number: number }[]

  const { data: assessmentsRaw } = await admin
    .from('assessments')
    .select('*, phases!phase_id(title, phase_number)')
    .in('phase_id', phases.map(p => p.id))

  const assessments = (assessmentsRaw ?? []) as Record<string, unknown>[]

  // Questions per assessment
  const { data: questionsRaw } = await admin
    .from('assessment_questions')
    .select('*')
    .in('assessment_id', assessments.map(a => a.id as string))
    .order('order_num')

  const questions = (questionsRaw ?? []) as Record<string, unknown>[]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Assessment Management" subtitle="Create, schedule, and manage phase assessments"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>
          <AssessmentManagerClient
            phases={phases}
            assessments={assessments}
            questions={questions}
          />
        </div>
      </main>
    </div>
  )
}
