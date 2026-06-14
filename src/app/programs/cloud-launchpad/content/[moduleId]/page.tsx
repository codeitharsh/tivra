export const runtime = 'edge'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import MarkCompleteButton from './MarkCompleteButton'
import type { Profile } from '@/types/database'

export default async function ModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  const admin = createAdminClient()

  // Fetch module with phase info
  const { data: modData } = await admin
    .from('modules')
    .select('*, phases(title, phase_number, program_id)')
    .eq('id', moduleId)
    .single()

  if (!modData) notFound()
  const mod = modData as {
    id: string; title: string; module_number: number
    notes_url: string | null; is_unlocked: boolean
    phases: { title: string; phase_number: number; program_id: string } | null
  }

  // Fetch student progress for this module
  const { data: progressData } = await supabase
    .from('module_progress')
    .select('status')
    .eq('student_id', user.id)
    .eq('module_id', moduleId)
    .maybeSingle()

  const status = (progressData as { status: string } | null)?.status ?? 'not_started'

  // Generate signed URL for notes PDF if exists
  let signedUrl: string | null = null
  if (mod.notes_url) {
    const { data: urlData } = await admin.storage
      .from('notes')
      .createSignedUrl(mod.notes_url, 3600) // 1 hour expiry
    signedUrl = urlData?.signedUrl ?? null
  }

  // Fetch related doubts for this module
  const { data: doubtsRaw } = await admin
    .from('doubts')
    .select('id, question_text, upvotes, is_resolved, created_at')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false })
    .limit(3)

  const doubts = (doubtsRaw ?? []) as {
    id: string; question_text: string; upvotes: number
    is_resolved: boolean; created_at: string
  }[]

  const phaseTitle = mod.phases?.title ?? ''
  const phaseNum   = mod.phases?.phase_number ?? 1

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex: 1, overflow: 'auto' }}>
        <Topbar title={mod.title} subtitle={`Phase ${phaseNum}: ${phaseTitle}`}/>

        <div style={{ padding: '28px', maxWidth: '900px' }}>

          {/* Breadcrumb */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '12px', color: 'var(--muted)', marginBottom: '24px',
          }}>
            <Link href="/programs/cloud-launchpad/content" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              Study Content
            </Link>
            <span>›</span>
            <span style={{ color: 'var(--muted)' }}>Phase {phaseNum}: {phaseTitle}</span>
            <span>›</span>
            <span style={{ color: 'var(--text)' }}>Module {mod.module_number}</span>
          </div>

          {/* Module header */}
          <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{
                  fontSize: '11px', color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px',
                }}>
                  Phase {phaseNum} · Module {mod.module_number}
                </div>
                <h1 style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 700,
                  fontSize: '22px', color: '#fff', marginBottom: '8px',
                }}>
                  {mod.title}
                </h1>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span className={`pill ${
                    status === 'completed' ? 'pill-active' :
                    status === 'in_progress' ? 'pill-in-progress' : 'pill-locked'
                  }`}>
                    {status === 'completed' ? '✓ Completed' :
                     status === 'in_progress' ? '▶ In Progress' : '○ Not started'}
                  </span>
                  {mod.notes_url && (
                    <span className="pill pill-active" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--teal)' }}>
                      📄 Notes available
                    </span>
                  )}
                </div>
              </div>
              {/* Mark complete button */}
              <MarkCompleteButton
                moduleId={mod.id}
                studentId={user.id}
                currentStatus={status}
              />
            </div>
          </div>

          {/* PDF Viewer */}
          {signedUrl ? (
            <div className="card" style={{ marginBottom: '20px', padding: '0', overflow: 'hidden' }}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px' }}>
                  📄 Module Notes
                </div>
                <a
                  href={signedUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  ⬇ Download PDF
                </a>
              </div>
              <iframe
                src={signedUrl}
                style={{ width: '100%', height: '600px', border: 'none', display: 'block' }}
                title={`${mod.title} Notes`}
              />
            </div>
          ) : (
            <div className="card" style={{
              marginBottom: '20px', textAlign: 'center', padding: '48px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>
                Notes not uploaded yet
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Your teacher will upload notes for this module soon.
              </div>
            </div>
          )}

          {/* Related doubts */}
          {doubts.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '16px',
              }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px' }}>
                  Doubts for this module
                </div>
                <Link
                  href={`/doubts?module=${moduleId}`}
                  style={{ fontSize: '12px', color: 'var(--teal)', textDecoration: 'none' }}
                >
                  View all →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {doubts.map(d => (
                  <div
                    key={d.id}
                    style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      borderLeft: `2px solid ${d.is_resolved ? 'var(--teal)' : 'var(--amber)'}`,
                    }}
                  >
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>{d.question_text}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {d.is_resolved
                        ? <span style={{ color: 'var(--teal)' }}>✓ Answered</span>
                        : <span style={{ color: 'var(--amber)' }}>⏳ Awaiting answer</span>
                      }
                      {' · '}{d.upvotes} upvotes
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation between modules */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <Link
              href="/programs/cloud-launchpad/content"
              className="btn btn-ghost"
              style={{ fontSize: '13px' }}
            >
              ← Back to Content
            </Link>
            <Link
              href="/doubts"
              className="btn btn-ghost"
              style={{ fontSize: '13px' }}
            >
              💬 Post a Doubt
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
