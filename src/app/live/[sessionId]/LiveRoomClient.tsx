'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'

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
        const res  = await fetch('/api/daily', {
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
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>
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
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--green)', boxShadow: '0 0 8px var(--green)',
              animation: 'pulse 2s ease-in-out infinite',
            }}/>
            <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>Live Now</span>
          </div>
        )}
        {isCompleted && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Session Ended</span>}
        {!isLive && !isCompleted && <span style={{ fontSize: '12px', color: 'var(--amber)' }}>Scheduled</span>}

        <Link href="/live" className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>
          ← All Classes
        </Link>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>

          {/* LIVE — embed Jitsi */}
          {isLive && roomUrl ? (
            <iframe
              src={roomUrl}
              allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', minHeight: '400px' }}
              title={String(session.title ?? 'Live Class')}
            />
          ) : isLive && loadingRoom ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--cyan)', marginBottom: '16px' }}/>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Joining class…</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Setting up your connection</div>
            </div>
          ) : isLive && !loadingRoom && !roomUrl ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '14px' }}>⚠️</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                Couldn&apos;t connect
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '320px', marginBottom: '20px' }}>
                Your account may not be active, or the room isn&apos;t ready yet.
              </p>
              <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ fontSize: '13px' }}>
                Refresh Page
              </button>
            </div>
          ) : isCompleted && session.recording_url ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>🎬</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>
                Recording Available
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
                This session has ended. Watch the full recording below.
              </p>
              <a href={session.recording_url as string} target="_blank" rel="noreferrer"
                className="btn btn-primary" style={{ fontSize: '14px', padding: '12px 28px' }}>
                ▶ Watch Recording
              </a>
            </div>
          ) : isCompleted ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>
                Session Completed
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '360px' }}>
                Recording will appear here once your teacher uploads it.
              </p>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>⏰</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>
                Class Not Started Yet
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '360px' }}>
                Scheduled for{' '}
                <strong style={{ color: '#fff' }}>
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
        <div style={{
          width: '260px', flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)',
        }}>
          {/* Attendance */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '11px',
              textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '10px' }}>
              Your Attendance
            </div>

            {attendanceMarked ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              }}>
                <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }}/>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green)' }}>Marked ✓</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>Join time recorded</div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '10px 12px', borderRadius: '10px',
                background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--amber)', marginBottom: '2px' }}>Pending…</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Recorded when class starts</div>
              </div>
            )}

            {requiresCode && !existingAttendance?.session_code && (
              <div style={{ marginTop: '12px' }}>
                <label className="form-label">Session Code</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="form-input" placeholder="Code" maxLength={4}
                    value={sessionCode}
                    onChange={e => setSessionCode(e.target.value.replace(/\D/, ''))}
                    style={{ flex: 1, textAlign: 'center', fontFamily: 'Syne,sans-serif',
                      fontWeight: 800, fontSize: '16px', letterSpacing: '0.2em' }}/>
                  <button className="btn btn-primary" onClick={submitCode}
                    disabled={submittingCode} style={{ fontSize: '11px', padding: '7px 12px', flexShrink: 0 }}>
                    {submittingCode ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/> : '✓'}
                  </button>
                </div>
                {codeError && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '5px' }}>{codeError}</div>}
              </div>
            )}
          </div>

          {/* Session info */}
          <div style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '11px',
              textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '10px' }}>
              Session Info
            </div>
            {[
              ['Duration',  `${String(session.duration_minutes ?? 60)} minutes`],
              ['Platform',  'Jitsi Meet (in-platform)'],
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
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
