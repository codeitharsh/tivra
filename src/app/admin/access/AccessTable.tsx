'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, Loader2, Search, ChevronDown, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Calls the edge-compatible /api/admin route (migrated off Server Actions,
//    which do not run reliably on Cloudflare Pages) ──────────────────────
async function callAdminApi(payload: Record<string, unknown>): Promise<{ error?: string; success?: boolean }> {
  const res = await fetch('/api/admin', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  return res.json()
}

const STATUS_META: Record<string, { color:string; bg:string; dot:string; label:string }> = {
  active:          { color:'var(--green)', bg:'rgba(34,197,94,0.12)',  dot:'●',  label:'Active'     },
  pending_payment: { color:'var(--amber)', bg:'rgba(245,158,11,0.12)', dot:'⏳', label:'Pending'    },
  restricted:      { color:'var(--red)',   bg:'rgba(239,68,68,0.12)',  dot:'🔒', label:'Restricted' },
}

const ROLE_META: Record<string, { color:string; bg:string }> = {
  student: { color:'#00c8f8', bg:'rgba(0,200,248,0.1)'   },
  teacher: { color:'#a78bfa', bg:'rgba(124,58,237,0.15)' },
  parent:  { color:'#93c5fd', bg:'rgba(59,91,219,0.15)'  },
  admin:   { color:'#fff',    bg:'rgba(59,91,219,0.3)'   },
}

type FS = 'all'|'pending_payment'|'active'|'restricted'
type FR = 'all'|'student'|'teacher'|'parent'|'admin'

export default function AccessTable({ rows }: { rows: Record<string,unknown>[] }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [search,    setSearch]    = useState('')
  const [sf,        setSf]        = useState<FS>('all')
  const [rf,        setRf]        = useState<FR>('all')
  const [actionId,  setActionId]  = useState<string|null>(null)
  const [toast,     setToast]     = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [grantM,    setGrantM]    = useState<Record<string,unknown>|null>(null)
  const [grantNotes,setGrantNotes]= useState('')
  const [grantRole, setGrantRole] = useState('student')
  // Which programme(s) to enrol the student in — previously missing
  // entirely from this manual-grant flow, which meant an admin
  // manually activating a student left them with an active account
  // but no enrolled_programs row, incorrectly locking them out of
  // every programme-scoped page once those checks existed.
  const [grantPlan,  setGrantPlan] = useState('cloud_launchpad')
  const [revokeM,   setRevokeM]   = useState<Record<string,unknown>|null>(null)

  const toast3 = (msg:string,type:'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500)
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const ok = !search ||
      String(r.full_name??'').toLowerCase().includes(q) ||
      String(r.email??'').toLowerCase().includes(q)
    return ok && (sf==='all'||r.access_status===sf) && (rf==='all'||r.role===rf)
  })

  const cntS = (s:string) => rows.filter(r=>r.access_status===s).length
  const cntR = (r:string) => rows.filter(u=>u.role===r).length

  async function doGrant() {
    if (!grantM) return
    setActionId(grantM.id as string)
    start(async () => {
      const r = await callAdminApi({
        action:     'grant_access',
        student_id: grantM.id as string,
        notes:      grantNotes,
        role:       grantRole,
        plan:       grantRole === 'student' ? grantPlan : undefined,
      })
      if (r?.error) toast3(r.error,'error')
      else { toast3(`✓ Access granted to ${grantM.full_name}`,'success'); router.refresh() }
      setGrantM(null); setGrantNotes(''); setGrantRole('student'); setGrantPlan('cloud_launchpad'); setActionId(null)
    })
  }

  async function doRevoke() {
    if (!revokeM) return
    setActionId(revokeM.id as string)
    start(async () => {
      const r = await callAdminApi({ action: 'revoke_access', student_id: revokeM.id as string })
      if (r?.error) toast3(r.error,'error')
      else { toast3(`Access revoked for ${revokeM.full_name}`,'success'); router.refresh() }
      setRevokeM(null); setActionId(null)
    })
  }

  async function doRoleChange(id:string, name:string, newRole:string) {
    setActionId(id)
    start(async () => {
      const r = await callAdminApi({ action: 'change_role', student_id: id, new_role: newRole })
      if (r?.error) toast3(r.error,'error')
      else { toast3(`✓ ${name}'s role → ${newRole}`,'success'); router.refresh() }
      setActionId(null)
    })
  }

  return (
    <div style={{position:'relative'}}>

      {/* Filters */}
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',minWidth:'200px',flex:1}}>
          <Search size={14} style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
          <input className="form-input" placeholder="Search by name or email…"
            value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:'36px'}}/>
        </div>

        {/* Status pills */}
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
          {(['all','pending_payment','active','restricted'] as FS[]).map(f=>(
            <button key={f} onClick={()=>setSf(f)} style={{
              padding:'6px 12px',borderRadius:'20px',border:'none',cursor:'pointer',
              fontSize:'11px',fontWeight:600,fontFamily:'DM Sans,sans-serif',transition:'all 0.15s',
              background:sf===f?'linear-gradient(135deg,#00c8f8,#7030d0)':'rgba(255,255,255,0.06)',
              color:sf===f?'#fff':'var(--muted)',
            }}>
              {f==='all'?`All (${rows.length})`:
               f==='pending_payment'?`⏳ Pending (${cntS('pending_payment')})`:
               f==='active'?`✓ Active (${cntS('active')})`:
               `🔒 Restricted (${cntS('restricted')})`}
            </button>
          ))}
        </div>

        {/* Role pills */}
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
          {(['all','student','teacher','parent','admin'] as FR[]).map(r=>(
            <button key={r} onClick={()=>setRf(r)} style={{
              padding:'6px 12px',borderRadius:'20px',
              border:`1px solid ${rf===r?'rgba(255,255,255,0.2)':'var(--border)'}`,
              cursor:'pointer',fontSize:'11px',fontWeight:600,
              fontFamily:'DM Sans,sans-serif',transition:'all 0.15s',
              background:rf===r?'rgba(255,255,255,0.08)':'transparent',
              color:rf===r?'#fff':'var(--muted)',
            }}>
              {r==='all'?'All roles':`${r.charAt(0).toUpperCase()+r.slice(1)} (${cntR(r)})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Progress</th>
                <th>Joined</th>
                <th style={{textAlign:'right',minWidth:'140px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && (
                <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:'40px'}}>
                  No users match this filter
                </td></tr>
              )}
              {filtered.map(raw=>{
                const row = raw as Record<string,string|number|boolean|null>
                const sm  = STATUS_META[row.access_status as string]??STATUS_META.restricted
                const rm  = ROLE_META[row.role as string]??ROLE_META.student
                const loading = actionId===row.id && isPending
                const ini = String(row.full_name??'?').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()

                return (
                  <tr key={row.id as string}>

                    {/* User */}
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <div style={{
                          width:'34px',height:'34px',borderRadius:'50%',flexShrink:0,
                          background:'linear-gradient(135deg,#00c8f8,#7030d0)',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'11px',color:'#fff',
                        }}>{ini}</div>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:500,fontSize:'13px'}}>{String(row.full_name??'—')}</div>
                          <div style={{fontSize:'11px',color:'var(--muted)',maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {String(row.email??'')}
                          </div>
                          {row.phone?<div style={{fontSize:'10px',color:'var(--muted)'}}>{String(row.phone)}</div>:null}
                        </div>
                      </div>
                    </td>

                    {/* Role dropdown */}
                    <td>
                      <div style={{position:'relative',display:'inline-block'}}>
                        <select
                          value={String(row.role??'student')}
                          onChange={e=>doRoleChange(row.id as string,String(row.full_name),e.target.value)}
                          disabled={loading}
                          style={{
                            appearance:'none',WebkitAppearance:'none',
                            background:rm.bg,color:rm.color,
                            border:'1px solid rgba(255,255,255,0.1)',
                            borderRadius:'20px',padding:'4px 26px 4px 10px',
                            fontSize:'11px',fontWeight:600,cursor:'pointer',
                            outline:'none',fontFamily:'DM Sans,sans-serif',
                          }}
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="parent">Parent</option>
                          <option value="admin">Admin</option>
                        </select>
                        <ChevronDown size={10} style={{
                          position:'absolute',right:'8px',top:'50%',
                          transform:'translateY(-50%)',color:rm.color,pointerEvents:'none',
                        }}/>
                      </div>
                      {loading&&<RefreshCw size={11} style={{marginLeft:'5px',color:'var(--muted)',animation:'spin 1s linear infinite',verticalAlign:'middle'}}/>}
                    </td>

                    {/* Status */}
                    <td>
                      <span style={{
                        display:'inline-flex',alignItems:'center',gap:'5px',
                        padding:'3px 10px',borderRadius:'20px',
                        fontSize:'11px',fontWeight:600,background:sm.bg,color:sm.color,
                      }}>
                        {sm.dot} {sm.label}
                      </span>
                      {row.payment_verified_at
                        ?<div style={{fontSize:'10px',color:'var(--muted)',marginTop:'2px'}}>
                          Approved {new Date(row.payment_verified_at as string).toLocaleDateString('en-IN')}
                         </div>
                        :null}
                    </td>

                    {/* Payment */}
                    <td>
                      {row.payment_request_status?(
                        <div>
                          <span style={{fontSize:'11px',fontWeight:600,
                            color:row.payment_request_status==='approved'?'var(--green)':
                                  row.payment_request_status==='rejected'?'var(--red)':'var(--amber)'}}>
                            {String(row.payment_request_status).toUpperCase()}
                          </span>
                          {row.transaction_ref
                            ?<div style={{fontSize:'10px',color:'var(--muted)'}}>Ref: {String(row.transaction_ref)}</div>
                            :null}
                        </div>
                      ):<span style={{fontSize:'11px',color:'var(--muted)'}}>—</span>}
                      {row.payment_notes?<div style={{fontSize:'10px',color:'var(--teal)'}}>{String(row.payment_notes)}</div>:null}
                    </td>

                    {/* Progress */}
                    <td>
                      <div style={{minWidth:'80px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                          <span style={{fontSize:'10px',color:'var(--muted)'}}>{row.modules_done??0}/24</span>
                          <span style={{fontSize:'10px',color:'var(--cyan)'}}>{row.progress_percent??0}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{width:`${row.progress_percent??0}%`}}/>
                        </div>
                      </div>
                    </td>

                    {/* Joined */}
                    <td style={{fontSize:'11px',color:'var(--muted)',whiteSpace:'nowrap'}}>
                      {row.created_at
                        ?new Date(row.created_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})
                        :'—'}
                    </td>

                    {/* Actions */}
                    <td>
                      <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                        {loading?(
                          <Loader2 size={16} style={{color:'var(--muted)',animation:'spin 1s linear infinite'}}/>
                        ):(
                          <>
                            {(row.access_status==='pending_payment'||row.access_status==='restricted')&&(
                              <button className="btn btn-success"
                                style={{padding:'5px 12px',fontSize:'11px',whiteSpace:'nowrap'}}
                                onClick={()=>{setGrantM(raw);setGrantRole(String(row.role??'student'))}}>
                                <CheckCircle2 size={12}/> Grant
                              </button>
                            )}
                            {row.access_status==='active'&&(
                              <button className="btn btn-danger"
                                style={{padding:'5px 12px',fontSize:'11px',whiteSpace:'nowrap'}}
                                onClick={()=>setRevokeM(raw)}>
                                <XCircle size={12}/> Revoke
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant modal */}
      {grantM&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,backdropFilter:'blur(4px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setGrantM(null)}}>
          <div className="glass" style={{width:'100%',maxWidth:'440px',padding:'28px',margin:'16px'}}>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'20px',marginBottom:'6px'}}>Grant Access</h2>
            <p style={{fontSize:'13px',color:'var(--muted)',marginBottom:'22px'}}>
              Granting access to <strong style={{color:'#fff'}}>{String(grantM.full_name??'')}</strong>
              <span style={{fontSize:'12px',color:'var(--muted)'}}> ({String(grantM.email??'')})</span>
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <label className="form-label">Role to assign</label>
                <select className="form-select" value={grantRole} onChange={e=>setGrantRole(e.target.value)}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                  <option value="admin">Admin</option>
                </select>
                <div style={{fontSize:'11px',color:'var(--muted)',marginTop:'5px'}}>
                  {grantRole==='teacher'&&'🎓 Can upload notes, schedule classes, resolve doubts.'}
                  {grantRole==='admin'  &&'⚡ Full platform access including this admin panel.'}
                  {grantRole==='parent' &&'👁 Read-only view of a linked student\'s progress.'}
                  {grantRole==='student'&&'📚 Access to all content, tests, and live classes.'}
                </div>
              </div>
              {grantRole === 'student' && (
                <div>
                  <label className="form-label">Programme</label>
                  <select className="form-select" value={grantPlan} onChange={e=>setGrantPlan(e.target.value)}>
                    <option value="cloud_launchpad">Cloud LaunchPad</option>
                    <option value="cloud_architect">Cloud Architect</option>
                    <option value="bundle">Bundle (both programmes)</option>
                  </select>
                  <div style={{fontSize:'11px',color:'var(--muted)',marginTop:'5px'}}>
                    Determines which programme(s) this student gets enrolled in and can access.
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" placeholder="e.g. UPI ref TXN123, Cash ₹5000, Batch Q1"
                  value={grantNotes} onChange={e=>setGrantNotes(e.target.value)}/>
              </div>
              <div className="banner banner-success" style={{margin:0}}>
                <CheckCircle2 size={16} style={{flexShrink:0}}/>
                <span style={{fontSize:'12px'}}>Sets access to <strong>Active</strong> — immediate full access.</span>
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}}
                  onClick={doGrant} disabled={isPending}>
                  {isPending
                    ?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Granting…</>
                    :<><CheckCircle2 size={14}/> Confirm Grant Access</>}
                </button>
                <button className="btn btn-ghost" onClick={()=>setGrantM(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirmation modal */}
      {revokeM&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,backdropFilter:'blur(4px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setRevokeM(null)}}>
          <div className="glass" style={{width:'100%',maxWidth:'400px',padding:'28px',margin:'16px',textAlign:'center'}}>
            <div style={{fontSize:'40px',marginBottom:'12px'}}>🔒</div>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'18px',marginBottom:'8px'}}>Revoke Access?</h2>
            <p style={{fontSize:'13px',color:'var(--muted)',marginBottom:'20px'}}>
              <strong style={{color:'#fff'}}>{String(revokeM.full_name??'')}</strong> will immediately
              lose access to all content, tests, and live classes. You can re-grant at any time.
            </p>
            <div style={{display:'flex',gap:'10px',justifyContent:'center'}}>
              <button className="btn btn-danger" style={{flex:1,justifyContent:'center'}}
                onClick={doRevoke} disabled={isPending}>
                {isPending
                  ?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Revoking…</>
                  :<><XCircle size={14}/> Yes, Revoke Access</>}
              </button>
              <button className="btn btn-ghost" onClick={()=>setRevokeM(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:'20px',right:'20px',zIndex:200}}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
