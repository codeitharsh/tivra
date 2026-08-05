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
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
          padding: '32px 28px', position: 'relative',
        }}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: 'var(--card2)', color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <X size={15}/>
        </button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: 'var(--radius)', margin: '0 auto 20px',
              background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={24} style={{ color: 'var(--green)' }}/>
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '18px', color: 'var(--text)', marginBottom: '10px' }}>
              Thanks, {fullName.split(' ')[0]}!
            </h3>
            {downloadUrl ? (
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
                Your download should start automatically.{' '}
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  Click here
                </a>{' '}if it doesn&apos;t.
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
                We&apos;ll email you the {programName} curriculum shortly.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 style={{ fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '18px', color: 'var(--text)', marginBottom: '6px' }}>
              Get the {programName} curriculum
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '22px' }}>
              Share a few details and we&apos;ll unlock the full curriculum PDF.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Full Name</label>
                <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required/>
              </div>
              <div>
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required/>
              </div>
              <div>
                <label className="form-label">Phone Number</label>
                <input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required/>
              </div>
              <div>
                <label className="form-label">Current Status</label>
                <select
                  className="form-select"
                  value={currentStatus}
                  onChange={e => setCurrentStatus(e.target.value as CurrentStatus)}
                >
                  <option value="student">Student</option>
                  <option value="graduate">Graduate</option>
                  <option value="working_professional">Working Professional</option>
                </select>
              </div>
              {currentStatus === 'student' && (
                <div>
                  <label className="form-label">College Name</label>
                  <input className="form-input" value={collegeName} onChange={e => setCollegeName(e.target.value)} placeholder="Your college/university"/>
                </div>
              )}
              <div>
                <label className="form-label">Graduation Year {currentStatus !== 'student' ? '(optional)' : ''}</label>
                <input
                  className="form-input" type="number" inputMode="numeric"
                  value={graduationYear} onChange={e => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2027" min={1990} max={2035}
                />
              </div>
            </div>

            {error && (
              <div className="banner banner-warning" style={{ marginTop: '14px', marginBottom: 0 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="btn btn-primary"
              style={{
                marginTop: '22px', width: '100%', justifyContent: 'center',
                cursor: status === 'submitting' ? 'wait' : 'pointer',
                opacity: status === 'submitting' ? 0.7 : 1,
              }}
            >
              {status === 'submitting' ? <><Loader2 size={15} className="spin"/> Submitting…</> : 'Get Curriculum'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
