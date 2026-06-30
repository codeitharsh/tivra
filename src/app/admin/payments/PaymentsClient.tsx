'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Calls the edge-compatible /api/admin route. The caller's admin identity
//    is taken from the verified session server-side — adminId is no longer
//    sent or trusted from the client. ──────────────────────────────────────
async function callAdminApi(payload: Record<string, unknown>): Promise<{ error?: string; success?: boolean }> {
  const res = await fetch('/api/admin', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  return res.json()
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

export default function PaymentsClient({ rows }: { rows: Record<string,unknown>[] }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<FilterStatus>('all')
  const [actionId,setActionId]= useState<string|null>(null)
  const [toast,   setToast]   = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [rejectModal, setRejectModal] = useState<Record<string,unknown>|null>(null)
  const [rejectNote,  setRejectNote]  = useState('')

  const showToast = (msg:string, type:'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500)
  }

  const filtered = rows.filter(r => {
    const p = r.profiles as Record<string,string>|null
    const q = search.toLowerCase()
    const match = !search || String(p?.full_name??'').toLowerCase().includes(q) || String(p?.email??'').toLowerCase().includes(q)
    return match && (filter==='all' || r.status===filter)
  })

  async function doApprove(row: Record<string,unknown>) {
    setActionId(row.id as string)
    start(async () => {
      const r = await callAdminApi({
        action:     'grant_access',
        student_id: row.student_id as string,
        notes:      `Payment approved — ${row.payment_method} ref: ${row.transaction_ref ?? 'N/A'}`,
        role:       'student',
        // Previously this call never passed the plan at all, meaning
        // grant_access had no way to know which programme(s) to
        // enrol the student in — see the comment in admin/route.ts
        // for why that left manually-approved students with an
        // active account but zero enrolled_programs rows.
        plan:       row.plan as string | undefined,
      })
      if (r?.error) showToast(r.error, 'error')
      else { showToast('✓ Payment approved — student activated', 'success'); router.refresh() }
      setActionId(null)
    })
  }

  async function doReject() {
    if (!rejectModal) return
    setActionId(rejectModal.id as string)
    start(async () => {
      const r = await callAdminApi({
        action:         'reject_payment',
        request_id:     rejectModal.id as string,
        rejection_note: rejectNote,
      })
      if (r?.error) showToast(r.error, 'error')
      else { showToast('Payment rejected', 'success'); router.refresh() }
      setRejectModal(null); setRejectNote(''); setActionId(null)
    })
  }

  const statusMeta: Record<string,{color:string;bg:string;label:string}> = {
    pending:  { color:'var(--amber)', bg:'rgba(245,158,11,0.12)', label:'Pending'  },
    approved: { color:'var(--green)', bg:'rgba(34,197,94,0.12)',  label:'Approved' },
    rejected: { color:'var(--red)',   bg:'rgba(239,68,68,0.12)',  label:'Rejected' },
  }

  return (
    <div style={{position:'relative'}}>
      {/* Search + filter */}
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:'200px'}}>
          <Search size={14} style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
          <input className="form-input" placeholder="Search by name or email…"
            value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:'36px'}}/>
        </div>
        {(['all','pending','approved','rejected'] as FilterStatus[]).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:'6px 14px',borderRadius:'20px',border:'none',cursor:'pointer',
            fontSize:'11px',fontWeight:600,fontFamily:'DM Sans,sans-serif',transition:'all 0.15s',
            background:filter===f?'linear-gradient(135deg,#00c8f8,#7030d0)':'rgba(255,255,255,0.06)',
            color:filter===f?'#fff':'var(--muted)',
          }}>
            {f==='all'?`All (${rows.length})`:
             f==='pending'?`⏳ Pending (${rows.filter(r=>r.status==='pending').length})`:
             f==='approved'?`✓ Approved (${rows.filter(r=>r.status==='approved').length})`:
             `✗ Rejected (${rows.filter(r=>r.status==='rejected').length})`}
          </button>
        ))}
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Submitted</th>
                <th>Status</th>
                <th style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&(
                <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:'40px'}}>No payment requests found</td></tr>
              )}
              {filtered.map(row=>{
                const p   = row.profiles as Record<string,string>|null
                const sm  = statusMeta[row.status as string]??statusMeta.pending
                const loading = actionId===row.id && isPending
                return (
                  <tr key={row.id as string}>
                    <td>
                      <div style={{fontWeight:500,fontSize:'13px'}}>{p?.full_name??'—'}</div>
                      <div style={{fontSize:'11px',color:'var(--muted)'}}>{p?.email??''}</div>
                      {p?.phone&&<div style={{fontSize:'10px',color:'var(--muted)'}}>{p.phone}</div>}
                    </td>
                    <td style={{fontSize:'12px',color:'var(--muted)',textTransform:'capitalize'}}>{String(row.payment_method??'—')}</td>
                    <td>
                      <span style={{fontFamily:'monospace',fontSize:'12px',color:row.transaction_ref?'var(--cyan)':'var(--muted)'}}>
                        {String(row.transaction_ref??'—')}
                      </span>
                    </td>
                    <td style={{fontSize:'13px',fontWeight:600,color:row.amount?'var(--green)':'var(--muted)'}}>
                      {row.amount?`₹${Number(row.amount).toLocaleString('en-IN')}`:'—'}
                    </td>
                    <td style={{fontSize:'11px',color:'var(--muted)',whiteSpace:'nowrap'}}>
                      {row.created_at?new Date(row.created_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}):'—'}
                    </td>
                    <td>
                      <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:sm.bg,color:sm.color}}>
                        {sm.label}
                      </span>
                      {row.rejection_note?<div style={{fontSize:'10px',color:'var(--red)',marginTop:'2px'}}>{String(row.rejection_note)}</div>:null}
                    </td>
                    <td style={{textAlign:'right'}}>
                      {loading?(
                        <Loader2 size={16} style={{color:'var(--muted)',animation:'spin 1s linear infinite'}}/>
                      ):row.status==='pending'?(
                        <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                          <button className="btn btn-success" style={{padding:'5px 12px',fontSize:'11px'}}
                            onClick={()=>doApprove(row)}>
                            <CheckCircle2 size={12}/> Approve
                          </button>
                          <button className="btn btn-danger" style={{padding:'5px 12px',fontSize:'11px'}}
                            onClick={()=>setRejectModal(row)}>
                            <XCircle size={12}/> Reject
                          </button>
                        </div>
                      ):null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,backdropFilter:'blur(4px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setRejectModal(null)}}>
          <div className="glass" style={{width:'100%',maxWidth:'420px',padding:'28px',margin:'16px'}}>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'18px',marginBottom:'8px'}}>Reject Payment?</h2>
            <p style={{fontSize:'13px',color:'var(--muted)',marginBottom:'18px'}}>
              This will reject the request from <strong style={{color:'#fff'}}>
                {String((rejectModal.profiles as Record<string,string>|null)?.full_name??'')}
              </strong>. They will remain in pending state.
            </p>
            <div style={{marginBottom:'16px'}}>
              <label className="form-label">Reason (shown to student)</label>
              <input className="form-input" placeholder="e.g. Transaction not found, Invalid reference"
                value={rejectNote} onChange={e=>setRejectNote(e.target.value)}/>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button className="btn btn-danger" style={{flex:1,justifyContent:'center'}} onClick={doReject} disabled={isPending}>
                {isPending?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Rejecting…</>:<><XCircle size={14}/> Confirm Reject</>}
              </button>
              <button className="btn btn-ghost" onClick={()=>setRejectModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:'20px',right:'20px',zIndex:200}}><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
