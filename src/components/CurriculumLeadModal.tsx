'use client'

import { useState } from 'react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  isOpen:      boolean
  onClose:     () => void
  programSlug: string
  programName: string
}

type Status = 'form' | 'submitting' | 'success' | 'error'
type CurrentStatus = 'student' | 'graduate' | 'working_professional'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)',
  marginBottom: '6px', fontWeight: 600, letterSpacing: '0.02em',
}

export default function CurriculumLeadModal({ isOpen, onClose, programSlug, programName }: Props) {
  const [status, setStatus]           = useState<Status>('form')
  const [error, setError]             = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const [fullName, setFullName]             = useState('')
  const [email, setEmail]                   = useState('')
  const [phone, setPhone]                   = useState('')
  const [collegeName, setCollegeName]       = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [currentStatus, setCurrentStatus]   = useState<CurrentStatus>('student')

  if (!isOpen) return null

  function reset() {
    setStatus('form'); setError(null); setDownloadUrl(null)
    setFullName(''); setEmail(''); setPhone(''); setCollegeName(''); setGraduationYear('')
    setCurrentStatus('student')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fullName.trim())            { setError('Full name is required.'); return }
    if (!email.trim().includes('@')) { setError('A valid email is required.'); return }
    if (phone.trim().length < 7)     { setError('A valid phone number is required.'); return }

    setStatus('submitting')
    try {
      const res = await fetch('/api/curriculum-leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_slug:    programSlug,
          full_name:       fullName.trim(),
          email:           email.trim(),
          phone:           phone.trim(),
          college_name:    collegeName.trim() || undefined,
          graduation_year: graduationYear ? Number(graduationYear) : undefined,
          current_status:  currentStatus,
        }),
      })
      const data = await res.json() as { success?: boolean; download_url?: string | null; error?: string }

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not submit your details. Please try again.')
        setStatus('error')
        return
      }

      setDownloadUrl(data.download_url ?? null)
      setStatus('success')
      if (data.download_url) {
        window.open(data.download_url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
          background: '#0d0f14', border: '1px solid #1c1f28', borderRadius: '20px',
          padding: '32px 28px', position: 'relative',
        }}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <X size={16}/>
        </button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={26} style={{ color: 'var(--green)' }}/>
            </div>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff', marginBottom: '10px' }}>
              Thanks, {fullName.split(' ')[0]}!
            </h3>
            {downloadUrl ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                Your download should start automatically.{' '}
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', textDecoration: 'none' }}>
                  Click here
                </a>{' '}if it doesn&apos;t.
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                We&apos;ll email you the {programName} curriculum shortly.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '18px', color: '#fff', marginBottom: '6px' }}>
              Get the {programName} curriculum
            </h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '22px' }}>
              Share a few details and we&apos;ll unlock the full curriculum PDF.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required/>
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required/>
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required/>
              </div>
              <div>
                <label style={labelStyle}>Current Status</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={currentStatus}
                  onChange={e => setCurrentStatus(e.target.value as CurrentStatus)}
                >
                  <option value="student" style={{ color: '#000' }}>Student</option>
                  <option value="graduate" style={{ color: '#000' }}>Graduate</option>
                  <option value="working_professional" style={{ color: '#000' }}>Working Professional</option>
                </select>
              </div>
              {currentStatus === 'student' && (
                <div>
                  <label style={labelStyle}>College Name</label>
                  <input style={inputStyle} value={collegeName} onChange={e => setCollegeName(e.target.value)} placeholder="Your college/university"/>
                </div>
              )}
              <div>
                <label style={labelStyle}>Graduation Year {currentStatus !== 'student' ? '(optional)' : ''}</label>
                <input
                  style={inputStyle} type="number" inputMode="numeric"
                  value={graduationYear} onChange={e => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2027" min={1990} max={2035}
                />
              </div>
            </div>

            {error && (
              <div style={{ marginTop: '14px', fontSize: '12px', color: '#ef4444' }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{
                marginTop: '22px', width: '100%', padding: '13px', borderRadius: '100px',
                background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                color: '#fff', border: 'none', fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px',
                cursor: status === 'submitting' ? 'wait' : 'pointer',
                opacity: status === 'submitting' ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {status === 'submitting' ? <><Loader2 size={15} className="spin"/> Submitting…</> : 'Get Curriculum →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
