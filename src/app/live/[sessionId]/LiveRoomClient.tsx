'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, ArrowLeft, AlertTriangle, PlayCircle, Check, Clock3, ExternalLink, Video } from 'lucide-react'

interface Props {
  session:            Record<string, unknown>
  studentId:          string
  studentName:        string
  existingAttendance: Record<string, unknown> | null
  requiresCode:       boolean
  sessionId:          string
}

export default function LiveRoomClient({
  session, studentId, studentName, existingAttendance, requiresCode, sessionId,
}: Props) {
  const [roomUrl,          setRoomUrl]          = useState<string | null>(null)
  const [loadingRoom,      setLoadingRoom]      = useState(false)
  const [attendanceMarked, setAttendanceMarked] = useState(!!existingAttendance?.joined_at)
  const [sessionCode,      setSessionCode]      = useState('')
  const [codeError,        setCodoError]        = useState('')
  const [submittingCode,   setSubmittingCode]   = useState(false)

  const phase       = session.phases as Record<string, unknown> | null
  const isLive      = session.is_live      as boolean
  const isCompleted = session.is_completed as boolean

  // ── Fetch student room URL when session goes live ─────────
  useEffect(() => {
    if (!isLive || roomUrl) return

    async function fetchRoom() {
      setLoadingRoom(true)
      try {
        const res  = await fetch('/api/live-session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'get_student_token', sessionId }),
        })
        const data = await res.json() as { roomUrl?: string; error?: string }
        if (res.ok && data.roomUrl) setRoomUrl(data.roomUrl)
      } catch { /* show fallback */ }
      setLoadingRoom(false)
    }

    fetchRoom()
  }, [isLive, sessionId, roomUrl])

  // ── Auto-mark attendance when session is live ─────────────
  useEffect(() => {
    if (!isLive || attendanceMarked) return
    fetch('/api/attendance', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'join', sessionId, studentId }),
    }).then(() => setAttendanceMarked(true)).catch(() => {})
  }, [isLive, sessionId, studentId, attendanceMarked])

  // ── Mark leave on unmount ──────────────────────────────────
  useEffect(() => {
    function handleLeave() {
      navigator.sendBeacon('/api/attendance',
        JSON.stringify({ action: 'leave', sessionId, studentId }))
    }
    window.addEventListener('beforeunload', handleLeave)
    return () => { window.removeEventListener('beforeunload', handleLeave); if (isLive) handleLeave() }
  }, [sessionId, studentId, isLive])

  // ── Session code ───────────────────────────────────────────
  async function submitCode() {
    if (!sessionCode.trim()) { setCodoError('Enter the code'); return }
    setSubmittingCode(true); setCodoError('')
    try {
      const res  = await fetch('/api/attendance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'join', sessionId, studentId, sessionCode: sessionCode.trim() }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) setCodoError(data.error ?? 'Invalid code')
      else { setAttendanceMarked(true); setCodoError('') }
    } catch { setCodoError('Something went wrong') }
    setSubmittingCode(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Header */}
      <div style={{
        padding: '12px 24px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '15px', marginBottom: '2px' }}>
            {String(session.title ?? '')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {phase ? `Phase ${String(phase.phase_number)}: ${String(phase.title)} · ` : ''}
            {new Date(session.scheduled_at as string).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            {' · '}{String(session.duration_minutes ?? 60)} min
          </div>
        </div>

        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="pulse-dot pulse-green"/>
            <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>LIVE NOW</span>
          </div>
        )}
        {isCompleted && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Session ended</span>}
        {!isLive && !isCompleted && <span style={{ fontSize: '12px', color: 'var(--amber)' }}>Scheduled</span>}

        <Link href="/live" className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>
          <ArrowLeft size={12}/> All classes
        </Link>
      </div>

      {/* Main area */}
      <div className="live-room-main" style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', background: '#000', minHeight: '260px' }}>

          {/* LIVE — join link opens Teams in a new tab (Teams blocks
              being embedded in a third-party iframe, so this can't be
              shown inline). A real click is required here rather than
              opening automatically — browsers block window.open() calls
              that don't originate from a direct user gesture. */}
          {isLive && roomUrl ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)', padding: '40px', textAlign: 'center' }}>
              <Video size={34} color="var(--accent-2)" style={{ marginBottom: '14px' }}/>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>
                Class is live
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '340px', marginBottom: '24px' }}>
                This class runs in Microsoft Teams — it&apos;ll open in a new tab.
              </p>
              <a href={roomUrl} target="_blank" rel="noreferrer"
                className="btn btn-primary" style={{ fontSize: '14px', padding: '12px 28px' }}>
                <ExternalLink size={14}/> Join in Teams
              </a>
            </div>
          ) : isLive && loadingRoom ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-2)', marginBottom: '16px' }}/>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Joining class…</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Setting up your connection</div>
            </div>
          ) : isLive && !loadingRoom && !roomUrl ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)', padding: '40px', textAlign: 'center' }}>
              <AlertTriangle size={30} color="var(--amber)" style={{ marginBottom: '14px' }}/>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '18px', marginBottom: '8px' }}>
                Couldn&apos;t connect
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '320px', marginBottom: '20px' }}>
                Your account may not be active, or the room isn&apos;t ready yet.
              </p>
              <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ fontSize: '13px' }}>
                Refresh page
              </button>
            </div>
          ) : isCompleted && session.recording_url ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)', padding: '40px', textAlign: 'center' }}>
              <PlayCircle size={34} color="var(--accent-2)" style={{ marginBottom: '14px' }}/>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>
                Recording available
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
                This session has ended. Watch the full recording below.
              </p>
              <a href={session.recording_url as string} target="_blank" rel="noreferrer"
                className="btn btn-primary" style={{ fontSize: '14px', padding: '12px 28px' }}>
                <PlayCircle size={14}/> Watch recording
              </a>
            </div>
          ) : isCompleted ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)', padding: '40px', textAlign: 'center' }}>
              <Check size={34} color="var(--green)" style={{ marginBottom: '14px' }}/>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>
                Session completed
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '360px' }}>
                Recording will appear here once your teacher uploads it.
              </p>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)', padding: '40px', textAlign: 'center' }}>
              <Clock3 size={38} color="var(--muted2)" style={{ marginBottom: '14px' }}/>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>
                Class not started yet
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '360px' }}>
                Scheduled for{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {new Date(session.scheduled_at as string).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </strong>.
                The class will appear here automatically when your teacher goes live.
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="live-room-sidebar" style={{
          width: '260px', flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)',
        }}>
          {/* Attendance */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div className="stat-label" style={{ marginBottom: '10px' }}>
              Your attendance
            </div>

            {attendanceMarked ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: 'var(--radius-sm)', background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.2)',
              }}>
                <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }}/>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green)' }}>Marked</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>Join time recorded</div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--amber)', marginBottom: '2px' }}>Pending…</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Recorded when class starts</div>
              </div>
            )}

            {requiresCode && !existingAttendance?.session_code && (
              <div style={{ marginTop: '12px' }}>
                <label className="form-label">Session code</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="form-input" placeholder="Code" maxLength={4}
                    value={sessionCode}
                    onChange={e => setSessionCode(e.target.value.replace(/\D/, ''))}
                    style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-serif)',
                      fontWeight: 600, fontSize: '16px', letterSpacing: '0.2em' }}/>
                  <button className="btn btn-primary" onClick={submitCode}
                    disabled={submittingCode} style={{ fontSize: '11px', padding: '7px 12px', flexShrink: 0 }}>
                    {submittingCode ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/> : <Check size={13}/>}
                  </button>
                </div>
                {codeError && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '5px' }}>{codeError}</div>}
              </div>
            )}
          </div>

          {/* Session info */}
          <div style={{ padding: '16px' }}>
            <div className="stat-label" style={{ marginBottom: '10px' }}>
              Session info
            </div>
            {[
              ['Duration',  `${String(session.duration_minutes ?? 60)} minutes`],
              ['Platform',  'Microsoft Teams (opens in new tab)'],
              ['Date',      new Date(session.scheduled_at as string).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })],
              ['Time',      new Date(session.scheduled_at as string).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '12px',
              }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '130px' }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 16px', marginTop: 'auto', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>Joining as</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{studentName}</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @media (max-width: 768px) {
          .live-room-main { flex-direction: column; }
          .live-room-sidebar {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid var(--border);
          }
        }
      `}</style>
    </div>
  )
}
