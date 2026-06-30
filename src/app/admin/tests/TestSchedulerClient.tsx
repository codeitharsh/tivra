'use client'

import { useState, useTransition } from 'react'
import { createClient as createSB } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Unlock } from 'lucide-react'

export default function TestSchedulerClient({ tests }: { tests: Record<string,unknown>[] }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [saving, setSaving] = useState<string|null>(null)
  const [dates, setDates] = useState<Record<string,{date:string;time:string}>>({})
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null)

  const showToast = (msg:string, type:'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3000)
  }

  function sb() {
    return createSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  }

  async function saveDate(testId: string) {
    const d = dates[testId]
    if (!d?.date || !d?.time) { showToast('Set both date and time', 'error'); return }
    setSaving(testId)
    start(async () => {
      const dt = new Date(`${d.date}T${d.time}:00`).toISOString()
      const { error } = await sb().from('weekly_tests')
        .update({ unlock_datetime: dt, is_manually_unlocked: false }).eq('id', testId)
      if (error) showToast(error.message, 'error')
      else { showToast('✓ Schedule saved', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  async function toggleManual(testId: string, current: boolean) {
    setSaving(testId)
    start(async () => {
      const { error } = await sb().from('weekly_tests')
        .update({ is_manually_unlocked: !current }).eq('id', testId)
      if (error) showToast(error.message, 'error')
      else { showToast(!current ? '✓ Test unlocked now' : 'Test re-locked', 'success'); router.refresh() }
      setSaving(null)
    })
  }

  const now = new Date()

  // Previously hardcoded to exactly phase1Tests/phase2Tests — only
  // ever correct for a programme with exactly 2 phases. Groups
  // dynamically by whatever phase numbers actually exist instead, so
  // this works for any programme regardless of how many phases it has.
  const phaseNumbers = Array.from(new Set(
    tests.map(t => (t.phases as Record<string, unknown> | null)?.phase_number as number | undefined)
      .filter((n): n is number => n != null)
  )).sort((a, b) => a - b)

  const testsByPhase = phaseNumbers.map(num => ({
    phaseNum: num,
    tests: tests.filter(t => (t.phases as Record<string,unknown>|null)?.phase_number === num),
  }))

  return (
    <div>
      {testsByPhase.map(({ phaseNum, tests: phaseTests }) => (
        <TestGroup key={phaseNum} phaseTests={phaseTests} phaseNum={phaseNum}
          now={now} saving={saving} isPending={isPending} dates={dates}
          setDates={setDates} saveDate={saveDate} toggleManual={toggleManual}/>
      ))}
      {toast&&<div style={{position:'fixed',bottom:'20px',right:'20px',zIndex:200}}><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// Previously declared as a nested function INSIDE TestSchedulerClient's
// body — React treats that as a brand-new component type on every
// render (ESLint's react-hooks/static-components rule flags this).
// Moved to genuine module scope; everything it previously accessed via
// closure (now, saving, isPending, dates, setDates, saveDate,
// toggleManual) is passed explicitly as props instead.
function TestGroup({
  phaseTests, phaseNum, now, saving, isPending, dates, setDates, saveDate, toggleManual,
}: {
  phaseTests: Record<string,unknown>[]
  phaseNum: number
  now: Date
  saving: string | null
  isPending: boolean
  dates: Record<string,{date:string;time:string}>
  setDates: React.Dispatch<React.SetStateAction<Record<string,{date:string;time:string}>>>
  saveDate: (testId: string) => void
  toggleManual: (testId: string, current: boolean) => void
}) {
  return (
    <div style={{ marginBottom:'28px' }}>
      <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px', marginBottom:'14px' }}>
        Phase {phaseNum} Weekly Tests
      </div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Topic</th>
              <th>Current Schedule</th>
              <th>Set New Date</th>
              <th>Set New Time</th>
              <th>Status</th>
              <th style={{textAlign:'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {phaseTests.map(t => {
              const isUnlocked = t.is_manually_unlocked ||
                (t.unlock_datetime ? now >= new Date(t.unlock_datetime as string) : false)
              const loading = saving === t.id && isPending
              const d = dates[t.id as string] ?? {}

              return (
                <tr key={t.id as string}>
                  <td style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:'var(--muted)', fontSize:'13px' }}>
                    W{String(t.week_number)}
                  </td>
                  <td style={{ fontSize:'13px', fontWeight:500 }}>
                    {String(t.topic ?? t.title ?? '')}
                  </td>
                  <td style={{ fontSize:'12px', color:'var(--muted)' }}>
                    {t.is_manually_unlocked
                      ? <span style={{color:'var(--green)',fontWeight:600}}>Manually unlocked</span>
                      : t.unlock_datetime
                      ? new Date(t.unlock_datetime as string).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
                      : <span style={{color:'var(--muted)'}}>Not scheduled</span>}
                  </td>
                  <td>
                    <input type="date" className="form-input" style={{fontSize:'12px',padding:'6px 10px'}}
                      value={d.date ?? ''}
                      onChange={e=>setDates(p=>({...p,[t.id as string]:{...p[t.id as string],date:e.target.value}}))}/>
                  </td>
                  <td>
                    <input type="time" className="form-input" style={{fontSize:'12px',padding:'6px 10px'}}
                      value={d.time ?? ''}
                      onChange={e=>setDates(p=>({...p,[t.id as string]:{...p[t.id as string],time:e.target.value}}))}/>
                  </td>
                  <td>
                    <span style={{
                      padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600,
                      background: isUnlocked ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                      color: isUnlocked ? 'var(--green)' : 'var(--muted)',
                    }}>
                      {isUnlocked ? '● Open' : '🔒 Locked'}
                    </span>
                  </td>
                  <td style={{textAlign:'right'}}>
                    <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                      {loading ? (
                        <Loader2 size={15} style={{color:'var(--muted)',animation:'spin 1s linear infinite'}}/>
                      ) : (
                        <>
                          <button className="btn btn-ghost" onClick={()=>saveDate(t.id as string)}
                            style={{fontSize:'11px',padding:'5px 12px'}}>
                            Save
                          </button>
                          <button
                            className={t.is_manually_unlocked ? 'btn btn-danger' : 'btn btn-success'}
                            onClick={()=>toggleManual(t.id as string, t.is_manually_unlocked as boolean)}
                            style={{fontSize:'11px',padding:'5px 12px'}}>
                            {t.is_manually_unlocked
                              ? <><Lock size={11}/> Re-lock</>
                              : <><Unlock size={11}/> Unlock Now</>}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
