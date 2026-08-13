'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Power, Copy, Check } from 'lucide-react'

interface Referral {
  id: string; faculty_name: string; faculty_email: string | null
  referral_code: string; discount_amount: number
  is_active: boolean; created_at: string
}
interface Stat { total: number; approved: number; revenue: number }

interface Enrollment {
  id: string; status: string; amount: number | null; plan: string | null
  created_at: string; referral_code: string | null
  profiles: { full_name: string; email: string; phone: string | null } | null
  faculty_referrals: { faculty_name: string } | null
}

interface Props {
  referrals: Referral[]
  stats: Record<string, Stat>
  adminId: string
  enrollments: Enrollment[]
}

const BLANK = { faculty_name: '', faculty_email: '', referral_code: '', discount_amount: 600 }

async function callApi(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json() as Promise<{ error?: string; success?: boolean }>
}

function generateCode(name: string) {
  const base = name.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
  const num  = Math.floor(Math.random() * 900) + 100
  return `${base}${num}`
}

export default function ReferralClient({ referrals, stats, enrollments }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [toast, setToast]  = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string|null>(null)
  const [copiedId, setCopiedId] = useState<string|null>(null)
  const [actionId, setActionId] = useState<string|null>(null)

  function showToast(msg: string, type: 'success'|'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openCreate() {
    setEditId(null)
    setForm(BLANK)
    setShowForm(true)
  }

  function openEdit(r: Referral) {
    setEditId(r.id)
    setForm({ faculty_name: r.faculty_name, faculty_email: r.faculty_email ?? '', referral_code: r.referral_code, discount_amount: r.discount_amount })
    setShowForm(true)
  }

  function copyCode(id: string, code: string) {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleSave() {
    if (!form.faculty_name.trim()) { showToast('Faculty name is required.', 'error'); return }
    if (!form.referral_code.trim()) { showToast('Referral code is required.', 'error'); return }

    setActionId('saving')
    start(async () => {
      const payload = editId
        ? { action: 'update_referral', id: editId, ...form }
        : { action: 'create_referral', ...form }

      const r = await callApi(payload)
      if (r.error) showToast(r.error, 'error')
      else { showToast(editId ? '✓ Referral updated.' : '✓ Referral code created.', 'success'); setShowForm(false); router.refresh() }
      setActionId(null)
    })
  }

  async function toggleActive(id: string, current: boolean) {
    setActionId(id)
    start(async () => {
      const r = await callApi({ action: 'toggle_referral', id, is_active: !current })
      if (r.error) showToast(r.error, 'error')
      else { showToast(current ? 'Referral deactivated.' : 'Referral activated.', 'success'); router.refresh() }
      setActionId(null)
    })
  }

  const totalReferrals  = referrals.length
  const totalEnrollments = referrals.reduce((s, r) => s + (stats[r.id]?.approved ?? 0), 0)
  const totalRevenue     = referrals.reduce((s, r) => s + (stats[r.id]?.revenue ?? 0), 0)

  return (
    <div>
      {/* Summary cards */}
      <div className="r-grid-3" style={{ marginBottom:'24px' }}>
        {[
          { label:'Total faculty codes', value: totalReferrals, color:'var(--accent-2)' },
          { label:'Total enrollments',   value: totalEnrollments, color:'var(--green)' },
          { label:'Total revenue',       value: `₹${totalRevenue.toLocaleString('en-IN')}`, color:'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize:'26px', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Create button */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
        <button className="btn btn-primary" onClick={openCreate} style={{ fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }}>
          <Plus size={14}/> New referral code
        </button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="card" style={{ marginBottom:'20px', border:'1px solid var(--accent-2)', background:'var(--accent-2-dim)' }}>
          <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'15px', marginBottom:'16px' }}>
            {editId ? 'Edit referral code' : 'Create new referral code'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div>
              <label className="form-label">Faculty name *</label>
              <input className="form-input" placeholder="e.g. Rahul Sharma"
                value={form.faculty_name}
                onChange={e => setForm(p => ({ ...p, faculty_name: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Faculty email</label>
              <input className="form-input" type="email" placeholder="optional"
                value={form.faculty_email}
                onChange={e => setForm(p => ({ ...p, faculty_email: e.target.value }))}/>
            </div>
            <div>
              <label className="form-label">Referral code *</label>
              <div style={{ display:'flex', gap:'8px' }}>
                <input className="form-input" placeholder="e.g. RAHUL100" style={{ flex:1 }}
                  value={form.referral_code}
                  onChange={e => setForm(p => ({ ...p, referral_code: e.target.value.toUpperCase().replace(/\s/g,'') }))}/>
                <button className="btn btn-ghost" style={{ fontSize:'11px', whiteSpace:'nowrap', flexShrink:0 }}
                  onClick={() => setForm(p => ({ ...p, referral_code: generateCode(form.faculty_name) }))}>
                  Auto-generate
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Discount amount (₹)</label>
              <input className="form-input" type="number" min="0" max="5000"
                value={form.discount_amount}
                onChange={e => setForm(p => ({ ...p, discount_amount: Number(e.target.value) }))}/>
              <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>
                Applied as a flat ₹{form.discount_amount.toLocaleString('en-IN')} discount off whichever programme the student enrols in.
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button className="btn btn-primary" disabled={!!actionId} onClick={handleSave} style={{ fontSize:'13px' }}>
              {actionId === 'saving' ? 'Saving…' : editId ? 'Update' : 'Create code'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ fontSize:'13px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Referral codes table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Referral Code</th>
              <th>Discount</th>
              <th>Referrals</th>
              <th>Enrolled</th>
              <th>Revenue</th>
              <th>Status</th>
              <th style={{ textAlign:'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {referrals.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--muted)', padding:'32px' }}>No referral codes yet. Create one above.</td></tr>
            )}
            {referrals.map(r => {
              const s = stats[r.id] ?? { total: 0, approved: 0, revenue: 0 }
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight:600, fontSize:'13px' }}>{r.faculty_name}</div>
                    {r.faculty_email && <div style={{ fontSize:'11px', color:'var(--muted)' }}>{r.faculty_email}</div>}
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <code style={{ fontFamily:'var(--font-mono)', fontSize:'13px', fontWeight:700, color:'var(--accent-2)', background:'var(--accent-2-dim)', padding:'3px 8px', borderRadius:'5px' }}>
                        {r.referral_code}
                      </code>
                      <button onClick={() => copyCode(r.id, r.referral_code)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:'2px' }}>
                        {copiedId === r.id ? <Check size={13} style={{ color:'var(--green)' }}/> : <Copy size={13}/>}
                      </button>
                    </div>
                  </td>
                  <td style={{ fontSize:'13px' }}>₹{r.discount_amount}</td>
                  <td style={{ fontFamily:'var(--font-serif)', fontWeight:600, color:'var(--accent-2)' }}>{s.total}</td>
                  <td style={{ fontFamily:'var(--font-serif)', fontWeight:600, color:'var(--green)' }}>{s.approved}</td>
                  <td style={{ fontFamily:'var(--font-serif)', fontWeight:600, color:'var(--accent)' }}>₹{s.revenue.toLocaleString('en-IN')}</td>
                  <td>
                    <span className="pill" style={{
                      background: r.is_active ? 'var(--green-dim)' : 'rgba(255,255,255,0.06)',
                      color: r.is_active ? 'var(--green)' : 'var(--muted)',
                    }}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => openEdit(r)} style={{ fontSize:'11px', padding:'5px 10px', display:'flex', alignItems:'center', gap:'4px' }}>
                        <Edit2 size={11}/> Edit
                      </button>
                      <button
                        className={r.is_active ? 'btn btn-danger' : 'btn btn-success'}
                        disabled={actionId === r.id && isPending}
                        onClick={() => toggleActive(r.id, r.is_active)}
                        style={{ fontSize:'11px', padding:'5px 10px', display:'flex', alignItems:'center', gap:'4px' }}>
                        <Power size={11}/> {r.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Enrollments detail table */}
      <div style={{ marginTop:'32px' }}>
        <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'16px', marginBottom:'14px' }}>
          All referral enrollments
        </div>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Contact</th>
                <th>Course</th>
                <th>Amount Paid</th>
                <th>Referral Code</th>
                <th>Faculty</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--muted)', padding:'32px' }}>No referral enrollments yet.</td></tr>
              )}
              {enrollments.map(e => {
                const profile = e.profiles
                const plan = e.plan?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'
                const date  = new Date(e.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
                return (
                  <tr key={e.id}>
                    <td style={{ fontWeight:600, fontSize:'13px' }}>{profile?.full_name ?? '—'}</td>
                    <td>
                      <div style={{ fontSize:'12px' }}>{profile?.email ?? '—'}</div>
                      {profile?.phone && <div style={{ fontSize:'11px', color:'var(--muted)' }}>{profile.phone}</div>}
                    </td>
                    <td style={{ fontSize:'13px' }}>{plan}</td>
                    <td style={{ fontFamily:'var(--font-serif)', fontWeight:600, color:'var(--green)', fontSize:'13px' }}>
                      {e.amount ? `₹${e.amount.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td>
                      <code style={{ fontFamily:'var(--font-mono)', fontSize:'12px', fontWeight:700, color:'var(--accent-2)', background:'var(--accent-2-dim)', padding:'2px 7px', borderRadius:'4px' }}>
                        {e.referral_code ?? '—'}
                      </code>
                    </td>
                    <td style={{ fontSize:'13px' }}>{e.faculty_referrals?.faculty_name ?? '—'}</td>
                    <td style={{ fontSize:'12px', color:'var(--muted)' }}>{date}</td>
                    <td>
                      <span className="pill" style={{
                        background: e.status === 'approved' ? 'var(--green-dim)' : e.status === 'pending' ? 'var(--amber-dim)' : 'var(--red-dim)',
                        color: e.status === 'approved' ? 'var(--green)' : e.status === 'pending' ? 'var(--amber)' : 'var(--red)',
                      }}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  )
}
