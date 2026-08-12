'use client'

import { useMemo, useState } from 'react'
import { Search, Download, Loader2 } from 'lucide-react'

interface Lead {
  id: string; full_name: string; email: string; phone: string
  college_name: string | null; graduation_year: number | null
  current_status: string | null; created_at: string
  programs: { name: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  student: 'Student',
  graduate: 'Graduate',
  working_professional: 'Working Professional',
}

export default function CurriculumLeadsClient({ leads }: { leads: Lead[] }) {
  const [search, setSearch]         = useState('')
  const [programme, setProgramme]   = useState('all')
  const [exporting, setExporting]   = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  const programmeOptions = useMemo(() => {
    const names = new Set(leads.map(l => l.programs?.name).filter((n): n is string => !!n))
    return Array.from(names).sort()
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter(l => {
      const matchesSearch = !q
        || l.full_name.toLowerCase().includes(q)
        || l.email.toLowerCase().includes(q)
        || l.phone.toLowerCase().includes(q)
      const matchesProgramme = programme === 'all' || l.programs?.name === programme
      return matchesSearch && matchesProgramme
    })
  }, [leads, search, programme])

  async function exportCsv() {
    setExporting(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'curriculum_leads_csv' }),
      })
      const data = await res.json() as { csv?: string | null; error?: string }
      if (!res.ok || !data.csv) throw new Error(data.error ?? 'Export failed')

      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `tivra-curriculum-leads-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      setToast('✓ CSV downloaded')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Export failed')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}/>
          <input
            className="form-input" placeholder="Search by name, email, or phone…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '34px' }}
          />
        </div>
        <select className="form-input" value={programme} onChange={e => setProgramme(e.target.value)} style={{ maxWidth: '220px', cursor: 'pointer' }}>
          <option value="all">All programmes</option>
          {programmeOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <button className="btn btn-ghost" disabled={exporting} onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap' }}>
          {exporting ? <Loader2 size={14} className="spin"/> : <Download size={14}/>} Export CSV
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Programme</th>
                <th>Contact</th>
                <th>College</th>
                <th>Grad. Year</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                  {leads.length === 0 ? 'No curriculum leads yet.' : 'No leads match your search/filter.'}
                </td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontSize: '13px', fontWeight: 500 }}>{l.full_name}</td>
                  <td style={{ fontSize: '13px' }}>{l.programs?.name ?? '—'}</td>
                  <td>
                    <div style={{ fontSize: '12px' }}>{l.email}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{l.phone}</div>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{l.college_name ?? '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>{l.graduation_year ?? '—'}</td>
                  <td style={{ fontSize: '11px', color: 'var(--muted)' }}>{STATUS_LABEL[l.current_status ?? ''] ?? '—'}</td>
                  <td style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className="toast toast-success">{toast}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
