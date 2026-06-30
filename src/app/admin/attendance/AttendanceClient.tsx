'use client'

import { useState } from 'react'
import { Download, Clock, CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

// ── Calls the edge-compatible /api/admin route (migrated off Server Actions) ──
async function callAdminApi(payload: Record<string, unknown>): Promise<{ error?: string; csv?: string | null }> {
  const res = await fetch('/api/admin', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  return res.json()
}

interface AttendanceSummary {
  present: number
  partial: number
  absent: number
  total: number
}

interface Props {
  sessions: Record<string, unknown>[]
  attendanceMap: Record<string, AttendanceSummary>
  totalStudents: number
}

export default function AttendanceClient({ sessions, attendanceMap, totalStudents }: Props) {
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [toast, setToast]         = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function exportCSV(sessionId?: string, sessionTitle?: string) {
    setExporting(sessionId ?? 'all')
    const result = await callAdminApi({ action: 'attendance_csv', session_id: sessionId })
    if (result.error) {
      showToast('Export failed: ' + result.error)
    } else if (result.csv) {
      // Trigger browser download
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `tivra-attendance${sessionTitle ? '-' + sessionTitle.replace(/[^a-z0-9]/gi, '_') : ''}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('✓ CSV downloaded')
    }
    setExporting(null)
  }

  function getAttendanceRate(summary: AttendanceSummary | undefined, total: number) {
    if (!summary || total === 0) return 0
    return Math.round(((summary.present + summary.partial * 0.5) / total) * 100)
  }

  return (
    <div>
      {/* Export all button */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
        <button
          className="btn btn-ghost"
          onClick={() => exportCSV(undefined, 'all-sessions')}
          disabled={!!exporting}
          style={{ fontSize:'13px' }}
        >
          <Download size={14}/>
          {exporting === 'all' ? 'Exporting…' : 'Export All Sessions CSV'}
        </button>
      </div>

      {sessions.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:'48px', color:'var(--muted)' }}>
          No live sessions yet. Schedule one from <strong>Live Sessions</strong>.
        </div>
      )}

      {/* Session cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {sessions.map(session => {
          const sid      = session.id as string
          const summary  = attendanceMap[sid]
          const rate     = getAttendanceRate(summary, totalStudents)
          const isOpen   = expanded === sid

          return (
            <div key={sid} className="card" style={{ padding:0, overflow:'hidden' }}>

              {/* Session header */}
              <div
                style={{
                  padding:'16px 20px', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:'16px',
                  borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                }}
                onClick={() => setExpanded(isOpen ? null : sid)}
              >
                {/* Status dot */}
                <div style={{
                  width:'8px', height:'8px', borderRadius:'50%', flexShrink:0,
                  background: session.is_live ? 'var(--green)' : session.is_completed ? 'var(--muted)' : 'var(--amber)',
                  boxShadow: session.is_live ? '0 0 8px var(--green)' : 'none',
                }}/>

                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'14px' }}>
                    {String(session.title)}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>
                    {session.scheduled_at
                      ? new Date(session.scheduled_at as string).toLocaleString('en-IN', {
                          dateStyle:'medium', timeStyle:'short',
                        })
                      : 'Not scheduled'}
                    {' · '}
                    {String(session.duration_minutes)} mins
                    {session.is_live ? <span style={{ color:'var(--green)', marginLeft:'8px', fontWeight:600 }}>● LIVE NOW</span> : null}
                    {session.is_completed ? <span style={{ color:'var(--muted)', marginLeft:'8px' }}>Completed</span> : null}
                  </div>
                </div>

                {/* Attendance rate */}
                <div style={{ textAlign:'right', minWidth:'120px' }}>
                  <div style={{
                    fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'22px',
                    color: rate >= 75 ? 'var(--green)' : rate >= 50 ? 'var(--amber)' : 'var(--red)',
                  }}>
                    {summary ? `${rate}%` : '—'}
                  </div>
                  <div style={{ fontSize:'10px', color:'var(--muted)' }}>
                    {summary ? `${summary.present + summary.partial}/${totalStudents} attended` : 'No data yet'}
                  </div>
                </div>

                {/* Attendance pills */}
                {summary && (
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:600, color:'var(--green)' }}>
                      <CheckCircle2 size={12}/>{summary.present} present
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:600, color:'var(--amber)' }}>
                      <AlertCircle size={12}/>{summary.partial} partial
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:600, color:'var(--red)' }}>
                      <XCircle size={12}/>{summary.absent} absent
                    </span>
                  </div>
                )}

                {/* Export + expand */}
                <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding:'5px 12px', fontSize:'11px' }}
                    onClick={e => { e.stopPropagation(); exportCSV(sid, String(session.title)) }}
                    disabled={exporting === sid}
                  >
                    <Download size={12}/>
                    {exporting === sid ? '…' : 'CSV'}
                  </button>
                  {isOpen ? <ChevronUp size={16} style={{ color:'var(--muted)' }}/> : <ChevronDown size={16} style={{ color:'var(--muted)' }}/>}
                </div>
              </div>

              {/* Expanded attendance detail */}
              {isOpen && (
                <div style={{ padding:'16px 20px' }}>
                  {!summary || summary.total === 0 ? (
                    <div style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', padding:'16px' }}>
                      No attendance records for this session yet.
                      {!session.is_completed && ' Records are created automatically when students join.'}
                    </div>
                  ) : (
                    <div>
                      {/* Stats row */}
                      <div className='r-grid-4' style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'16px' }}>
                        {[
                          { label:'Present',      value:summary.present,  color:'var(--green)', icon:'✓' },
                          { label:'Partial (<50%)',value:summary.partial,  color:'var(--amber)', icon:'⚡' },
                          { label:'Absent',        value:summary.absent,   color:'var(--red)',   icon:'✗' },
                          { label:'Attendance Rate',value:`${rate}%`,      color: rate>=75?'var(--green)':rate>=50?'var(--amber)':'var(--red)', icon:'📊' },
                        ].map(s => (
                          <div key={s.label} style={{
                            background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'12px',
                            border:'1px solid var(--border)',
                          }}>
                            <div style={{ fontSize:'9px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>{s.label}</div>
                            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'22px', color:s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div className="progress-track" style={{ marginBottom:'12px' }}>
                        <div style={{
                          height:'100%', borderRadius:'3px',
                          width:`${rate}%`,
                          background: rate>=75
                            ? 'var(--green)'
                            : 'linear-gradient(135deg,var(--cyan),var(--purple))',
                          transition:'width 0.6s ease',
                        }}/>
                      </div>

                      <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'8px' }}>
                        <Clock size={12} style={{ display:'inline', marginRight:'4px' }}/>
                        Attendance is auto-recorded. Join time, leave time, and duration are captured when students interact with the live class page.
                        Download the CSV for full individual records.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:200 }}>
          <div className="toast toast-success">{toast}</div>
        </div>
      )}
    </div>
  )
}
