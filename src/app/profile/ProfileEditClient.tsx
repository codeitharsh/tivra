'use client'

import { useState, useTransition } from 'react'
import { createClient as createSB } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Edit2, Check, X, Loader2 } from 'lucide-react'
import type { Profile } from '@/types/database'

export default function ProfileEditClient({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [isPending, start] = useTransition()

  const [editing,   setEditing]   = useState(false)
  const [fullName,  setFullName]  = useState(profile.full_name ?? '')
  const [phone,     setPhone]     = useState(profile.phone ?? '')
  const [toast,     setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function saveChanges() {
    if (!fullName.trim()) { showToast('Name cannot be empty', 'error'); return }

    start(async () => {
      const sb = createSB(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error } = await sb
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq('id', profile.id)

      if (error) showToast(error.message, 'error')
      else {
        showToast('✓ Profile updated', 'success')
        setEditing(false)
        router.refresh()
      }
    })
  }

  const roleColors: Record<string, string> = {
    student: 'var(--cyan)', teacher: '#a78bfa',
    parent:  '#93c5fd',    admin:   'var(--green)',
  }
  const statusColors: Record<string, string> = {
    active: 'var(--green)', pending_payment: 'var(--amber)', restricted: 'var(--red)',
  }

  const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div>
      {/* Avatar card */}
      <div className="card" style={{
        marginBottom: '20px', padding: '32px', textAlign: 'center',
        background: 'linear-gradient(135deg,rgba(0,212,255,0.05),rgba(124,58,237,0.05))',
        border: '1px solid rgba(59,91,219,0.2)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg,#00d4ff,#3b5bdb,#7c3aed)',
        }}/>

        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          margin: '0 auto 16px',
          background: 'linear-gradient(135deg,#00c8f8,#7030d0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '28px', color: '#fff',
          boxShadow: '0 0 32px rgba(59,91,219,0.35)',
        }}>
          {initials}
        </div>

        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '22px', marginBottom: '4px' }}>
          {profile.full_name ?? '—'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
          {profile.email}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            background: `${roleColors[profile.role ?? 'student']}20`,
            color: roleColors[profile.role ?? 'student'],
          }}>
            {(profile.role ?? 'student').charAt(0).toUpperCase() + (profile.role ?? 'student').slice(1)}
          </span>
          <span style={{
            padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            background: `${statusColors[profile.access_status ?? 'pending_payment']}18`,
            color: statusColors[profile.access_status ?? 'pending_payment'],
          }}>
            {profile.access_status === 'pending_payment' ? 'Pending Activation'
              : profile.access_status === 'active'       ? 'Active'
              : 'Restricted'}
          </span>
          {(profile.streak_count ?? 0) > 0 && (
            <span style={{
              padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
              background: 'rgba(245,158,11,0.12)', color: 'var(--amber)',
            }}>
              🔥 {profile.streak_count} day streak
            </span>
          )}
        </div>
      </div>

      {/* Edit card */}
      <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px',
        }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px' }}>
            Account Details
          </div>
          {!editing ? (
            <button className="btn btn-ghost" onClick={() => setEditing(true)}
              style={{ fontSize: '12px', padding: '7px 14px' }}>
              <Edit2 size={13}/> Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" onClick={saveChanges} disabled={isPending}
                style={{ fontSize: '12px', padding: '7px 14px' }}>
                {isPending
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/>
                  : <><Check size={13}/> Save</>}
              </button>
              <button className="btn btn-ghost" onClick={() => {
                setEditing(false)
                setFullName(profile.full_name ?? '')
                setPhone(profile.phone ?? '')
              }} style={{ fontSize: '12px', padding: '7px 12px' }}>
                <X size={13}/>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Editable: Full Name */}
          <div>
            <label className="form-label">Full Name</label>
            {editing ? (
              <input className="form-input" value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"/>
            ) : (
              <div style={{ fontSize: '14px', fontWeight: 500, padding: '11px 0' }}>
                {profile.full_name ?? '—'}
              </div>
            )}
          </div>

          {/* Editable: Phone */}
          <div>
            <label className="form-label">Phone Number</label>
            {editing ? (
              <input className="form-input" value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210" type="tel"/>
            ) : (
              <div style={{ fontSize: '14px', fontWeight: 500, padding: '11px 0',
                color: profile.phone ? '#fff' : 'var(--muted)' }}>
                {profile.phone ?? 'Not added'}
              </div>
            )}
          </div>

          {/* Read-only fields */}
          {[
            { label: 'Email Address',  value: profile.email ?? '—',         note: 'Cannot be changed' },
            { label: 'Member Since',   value: profile.created_at
              ? new Date(profile.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
              : '—', note: undefined },
          ].map(({ label, value, note }) => (
            <div key={label}>
              <label className="form-label">{label}</label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{value}</span>
                {note && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{note}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats card */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px', marginBottom: '16px' }}>
          Activity Stats
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          {[
            { icon: '🔥', label: 'Day Streak',    value: String(profile.streak_count ?? 0) },
            { icon: '📅', label: 'Last Login',    value: profile.last_login_date
              ? new Date(profile.last_login_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
              : 'Never' },
            { icon: '🏫', label: 'Programme',     value: profile.enrolled_program_id ? 'Cloud LaunchPad' : '—' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '14px', borderRadius: '10px', textAlign: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px',
                textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
