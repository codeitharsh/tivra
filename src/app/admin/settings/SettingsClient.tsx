'use client'

import { useState, useTransition } from 'react'
import { createClient as createSB } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Loader2, Plus } from 'lucide-react'

// internal domain record type (approved_colleges table)

export default function SettingsClient({ colleges }: { colleges: Record<string,unknown>[] }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [newName,   setNewName]   = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null)

  const showToast = (msg:string, type:'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3000)
  }

  function sb() {
    return createSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  }

  async function addDomain() {
    if (!newName.trim() || !newDomain.trim()) { showToast('Name and domain required', 'error'); return }
    const domain = newDomain.toLowerCase().replace('@','').trim()
    start(async () => {
      const { error } = await sb().from('approved_colleges').insert({ college_name: newName.trim(), email_domain: domain })
      if (error) showToast(error.message, 'error')
      else { showToast('✓ Domain added', 'success'); setNewName(''); setNewDomain(''); router.refresh() }
    })
  }

  async function removeDomain(id: string) {
    if (!confirm('Remove this domain record?')) return
    start(async () => {
      const { error } = await sb().from('approved_colleges').delete().eq('id', id)
      if (error) showToast(error.message, 'error')
      else { showToast('Removed', 'success'); router.refresh() }
    })
  }

  return (
    <div>

      {/* Batch management link */}
      <div className="card" style={{ marginBottom:'24px', padding:'20px',
        background:'rgba(0,200,248,0.05)', border:'1px solid rgba(0,200,248,0.2)' }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'15px', marginBottom:'6px' }}>
          Batch Management
        </div>
        <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'14px' }}>
          Create open and private batches, set enrolment windows, and manage cohorts.
        </div>
        <Link href="/admin/batches" className="btn btn-primary" style={{ fontSize:'13px', padding:'9px 20px' }}>
          Go to Batch Manager →
        </Link>
      </div>

      {/* Domain records — internal use only */}
      <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'16px', marginBottom:'6px' }}>
        Organisation Domain Records
      </div>
      <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'16px' }}>
        Internal record-keeping only. These domains do <strong style={{color:'#fff'}}>not</strong> grant
        any automatic access — all students are still activated manually by admin.
      </div>

      <div className="card" style={{ marginBottom:'20px', padding:'18px' }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:'13px', marginBottom:'12px' }}>
          Add Domain Record
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'10px', alignItems:'end' }}>
          <div>
            <label className="form-label">Organisation Name</label>
            <input className="form-input" placeholder="e.g. NGF College of Engineering"
              value={newName} onChange={e=>setNewName(e.target.value)}/>
          </div>
          <div>
            <label className="form-label">Email Domain</label>
            <input className="form-input" placeholder="ngf.ac.in"
              value={newDomain} onChange={e=>setNewDomain(e.target.value)}/>
          </div>
          <button className="btn btn-primary" onClick={addDomain} disabled={isPending}
            style={{ fontSize:'12px', padding:'10px 16px', whiteSpace:'nowrap' }}>
            {isPending?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<><Plus size={13}/> Add</>}
          </button>
        </div>
      </div>

      {colleges.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'32px', color:'var(--muted)', fontSize:'13px' }}>
          No domain records added yet.
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Email Domain</th>
                <th style={{textAlign:'right'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map(c=>(
                <tr key={c.id as string}>
                  <td style={{fontWeight:500}}>{String(c.college_name??'')} </td>
                  <td><span style={{fontFamily:'monospace',fontSize:'12px',color:'var(--cyan)'}}>{String(c.email_domain??'')} </span></td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-danger" onClick={()=>removeDomain(c.id as string)}
                      style={{fontSize:'11px',padding:'4px 10px'}} disabled={isPending}>
                      <Trash2 size={11}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:'20px',right:'20px',zIndex:200}}><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
