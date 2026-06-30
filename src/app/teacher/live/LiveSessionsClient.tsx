'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Plus, X, Video, Radio,
  Square, ExternalLink, RefreshCw,
} from 'lucide-react'

interface Batch { id: string; name: string; batch_type: string; status: string }

interface Props {
  sessions: Record<string, unknown>[]
  phases:   Record<string, unknown>[]
  batches:  Batch[]
}

const BATCH_COLOR: Record<string, string> = {
  open:'var(--cyan)', college:'#a78bfa', corporate:'#f59e0b', custom:'#93c5fd',
}

// all writes go through /api/daily — no direct Supabase client needed

async function callDaily(action: string, sessionId: string, extra?: Record<string,unknown>) {
  const res = await fetch('/api/daily', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action, sessionId, ...extra }),
  })
  return res
}

export default function LiveSessionsClient({ sessions, phases, batches }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [showForm,    setShowForm]    = useState(false)
  const [toast,       setToast]       = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [actionId,    setActionId]    = useState<string|null>(null)
  const [recordingId, setRecordingId] = useState<string|null>(null)
  const [manualUrl,   setManualUrl]   = useState('')
  const [form, setForm] = useState({
    title:'', description:'', phase_id:'', module_id:'',
    batch_id:'', date:'', time:'', duration:'60',
  })

  const showToast = (msg:string,type:'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000)
  }

  const selectedPhase = phases.find(p=>p.id===form.phase_id) as {modules?:Record<string,unknown>[]}|undefined
  const phaseModules  = (selectedPhase?.modules??[]) as Record<string,unknown>[]

  async function createSession() {
    if (!form.title||!form.date||!form.time){showToast('Title, date, and time required','error');return}
    const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString()
    start(async()=>{
      const res  = await callDaily('schedule_session', '', {
        title:           form.title,
        description:     form.description||null,
        phaseId:         form.phase_id||null,
        moduleId:        form.module_id||null,
        batchId:         form.batch_id||null,
        scheduledAt,
        durationMinutes: Number(form.duration),
      })
      const data = await res.json() as {error?:string}
      if(!res.ok){showToast(data.error??'Failed to schedule','error');return}
      showToast('✓ Class scheduled!','success')
      setForm({title:'',description:'',phase_id:'',module_id:'',batch_id:'',date:'',time:'',duration:'60'})
      setShowForm(false)
      router.refresh()
    })
  }

  async function goLive(sessionId:string) {
    setActionId(sessionId)
    start(async()=>{
      try {
        const res  = await callDaily('create_room', sessionId)
        let data: {error?:string;teacherUrl?:string} = {}
        try { data = await res.json() } catch { /* empty response */ }

        if(!res.ok || !data.teacherUrl) {
          showToast(data.error ?? `Server error (${res.status}) — check that DAILY_API_KEY is set in .env.local`, 'error')
          setActionId(null); return
        }

        await callDaily('go_live', sessionId)
        window.open(data.teacherUrl,'_blank','noopener,noreferrer')
        showToast('🔴 Live! Room opened in new tab — students can now join Tivra.','success')
        router.refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        showToast(`Connection error: ${msg}`, 'error')
      }
      setActionId(null)
    })
  }

  async function rejoinRoom(sessionId:string) {
    setActionId(sessionId)
    start(async()=>{
      try {
        const res  = await callDaily('create_room', sessionId)
        const data = await res.json() as {teacherUrl?:string;error?:string}
        if(data.teacherUrl) window.open(data.teacherUrl,'_blank','noopener,noreferrer')
        else showToast(data.error??'Failed','error')
      } catch {showToast('Network error','error')}
      setActionId(null)
    })
  }

  async function endSession(sessionId:string) {
    if(!confirm('End this session? Recording will be saved automatically.')) return
    setActionId(sessionId)
    start(async()=>{
      const res  = await callDaily('end_session', sessionId)
      const data = await res.json() as {recordingUrl?:string}
      showToast(data.recordingUrl
        ? '✓ Session ended. Recording saved!'
        : '✓ Session ended. Recording may take a few minutes.','success')
      setActionId(null)
      router.refresh()
    })
  }

  async function fetchRecording(sessionId:string) {
    setActionId(sessionId)
    start(async()=>{
      const res  = await callDaily('fetch_recording', sessionId)
      const data = await res.json() as {recordings?:unknown[];error?:string}
      if(data.recordings?.length) showToast(`✓ Recording found!`,'success')
      else showToast('No recording yet — try again in a few minutes','error')
      setActionId(null)
      router.refresh()
    })
  }

  async function saveManualRecording(sessionId:string) {
    if(!manualUrl.trim()) return
    start(async()=>{
      const res  = await callDaily('save_recording', sessionId, { recordingUrl: manualUrl.trim() })
      const data = await res.json() as {error?:string}
      if(!res.ok){showToast(data.error??'Failed','error');return}
      showToast('✓ Recording URL saved','success')
      setRecordingId(null); setManualUrl(''); router.refresh()
    })
  }

  const now = new Date()
  function getStatus(s:Record<string,unknown>) {
    if(s.is_live) return 'live'
    if(s.is_completed) return 'ended'
    const diff = (new Date(s.scheduled_at as string).getTime()-now.getTime())/60000
    if(diff<=15&&diff>0) return 'starting'
    return diff>0 ? 'upcoming' : 'missed'
  }

  const STATUS: Record<string,{label:string;color:string;bg:string}> = {
    live:     {label:'🔴 Live Now',    color:'var(--green)',bg:'rgba(34,197,94,0.12)'},
    starting: {label:'⏳ Starting Soon',color:'var(--amber)',bg:'rgba(245,158,11,0.12)'},
    upcoming: {label:'Scheduled',      color:'var(--muted)',bg:'rgba(255,255,255,0.06)'},
    ended:    {label:'Ended',          color:'var(--muted)',bg:'rgba(255,255,255,0.04)'},
    missed:   {label:'Missed',         color:'var(--red)',  bg:'rgba(239,68,68,0.08)'},
  }

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',color:'var(--muted)'}}>
          Powered by <span style={{color:'var(--cyan)',fontWeight:600}}>Jitsi Meet</span>
          {' '}— free, open source, students stay inside Tivra
        </div>
        <button className="btn btn-primary" onClick={()=>setShowForm(v=>!v)} style={{fontSize:'13px'}}>
          {showForm?<><X size={14}/> Cancel</>:<><Plus size={14}/> Schedule Class</>}
        </button>
      </div>

      {/* Schedule form */}
      {showForm?(
        <div className="card" style={{marginBottom:'20px',padding:'24px',border:'1px solid rgba(0,200,248,0.2)'}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',marginBottom:'18px'}}>
            Schedule New Class
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px'}}>
            <div style={{gridColumn:'span 2'}}>
              <label className="form-label">Class Title *</label>
              <input className="form-input" placeholder="e.g. IAM & Security — Week 3"
                value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
            </div>

            {/* Batch pills */}
            <div style={{gridColumn:'span 2'}}>
              <label className="form-label">Batch *</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <button type="button" onClick={()=>setForm(f=>({...f,batch_id:''}))} style={{
                  padding:'8px 16px',borderRadius:'100px',cursor:'pointer',
                  fontSize:'12px',fontWeight:600,fontFamily:'DM Sans,sans-serif',
                  border:form.batch_id===''?'1px solid rgba(0,200,248,0.5)':'1px solid var(--border)',
                  background:form.batch_id===''?'rgba(0,200,248,0.12)':'rgba(255,255,255,0.04)',
                  color:form.batch_id===''?'var(--cyan)':'var(--muted)',
                }}>🌐 All Batches</button>
                {batches.map(b=>(
                  <button key={b.id} type="button" onClick={()=>setForm(f=>({...f,batch_id:b.id}))} style={{
                    padding:'8px 16px',borderRadius:'100px',cursor:'pointer',
                    fontSize:'12px',fontWeight:600,fontFamily:'DM Sans,sans-serif',
                    border:form.batch_id===b.id?`1px solid ${BATCH_COLOR[b.batch_type]??'var(--cyan)'}80`:'1px solid var(--border)',
                    background:form.batch_id===b.id?`${BATCH_COLOR[b.batch_type]??'var(--cyan)'}18`:'rgba(255,255,255,0.04)',
                    color:form.batch_id===b.id?(BATCH_COLOR[b.batch_type]??'var(--cyan)'):'var(--muted)',
                    display:'flex',alignItems:'center',gap:'6px',
                  }}>
                    <span style={{width:'6px',height:'6px',borderRadius:'50%',background:BATCH_COLOR[b.batch_type]??'var(--cyan)',flexShrink:0}}/>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Phase (optional)</label>
              <select className="form-select" value={form.phase_id}
                onChange={e=>setForm(f=>({...f,phase_id:e.target.value,module_id:''}))}>
                <option value="">No phase</option>
                {phases.map(p=>(
                  <option key={p.id as string} value={p.id as string}>
                    Phase {String(p.phase_number)}: {String(p.title)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Module (optional)</label>
              <select className="form-select" value={form.module_id}
                onChange={e=>setForm(f=>({...f,module_id:e.target.value}))}>
                <option value="">No module</option>
                {phaseModules.map(m=>(
                  <option key={m.id as string} value={m.id as string}>
                    {String(m.module_number)}. {String(m.title)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" value={form.date}
                onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            </div>
            <div>
              <label className="form-label">Time *</label>
              <input className="form-input" type="time" value={form.time}
                onChange={e=>setForm(f=>({...f,time:e.target.value}))}/>
            </div>
            <div style={{gridColumn:'span 2'}}>
              <label className="form-label">Duration (minutes)</label>
              <input className="form-input" type="number" min="15" max="300"
                value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))}/>
            </div>
            <div style={{gridColumn:'span 2'}}>
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input" rows={2} style={{resize:'vertical'}}
                placeholder="Topics covered in this session…"
                value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </div>
          </div>

          <div className="banner banner-info" style={{marginTop:'14px'}}>
            <Video size={14} style={{flexShrink:0,color:'var(--cyan)'}}/>
            <span style={{fontSize:'13px'}}>
              A Jitsi room is created automatically when you click <strong style={{color:'#fff'}}>Go Live</strong>.
              Students join inside Tivra — completely free, no subscription needed.
            </span>
          </div>

          <button className="btn btn-primary" onClick={createSession} disabled={isPending}
            style={{marginTop:'16px',fontSize:'13px',padding:'11px 24px'}}>
            {isPending
              ?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Scheduling…</>
              :<><Video size={14}/> Schedule Class</>}
          </button>
        </div>
      ) : null}

      {/* Sessions list */}
      {sessions.length===0?(
        <div className="card" style={{textAlign:'center',padding:'48px',color:'var(--muted)'}}>
          <div style={{fontSize:'32px',marginBottom:'12px'}}>🎥</div>
          <div style={{fontSize:'14px',marginBottom:'16px'}}>No sessions scheduled yet.</div>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)} style={{fontSize:'13px'}}>
            <Plus size={13}/> Schedule First Class
          </button>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {sessions.map(rawS=>{
            const s   = rawS
            const st  = getStatus(s)
            const cfg = STATUS[st]
            const batch = s.batches as Record<string,string>|null
            const phase = s.phases  as Record<string,unknown>|null
            const sid   = s.id as string
            const busy  = actionId===sid&&isPending
            const hasRoom = !!(s.daily_room_name)

            return (
              <div key={sid} className="card" style={{padding:'18px 20px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:'14px',flexWrap:'wrap'}}>
                  {/* Live pulse dot */}
                  <div style={{
                    width:'8px',height:'8px',borderRadius:'50%',flexShrink:0,marginTop:'6px',
                    background:st==='live'?'var(--green)':st==='starting'?'var(--amber)':st==='missed'?'var(--red)':'rgba(255,255,255,0.2)',
                    boxShadow:st==='live'?'0 0 8px var(--green)':'none',
                    animation:st==='live'?'pulse 2s ease-in-out infinite':'none',
                  }}/>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'14px',marginBottom:'4px'}}>
                      {String(s.title??'')}
                    </div>
                    <div style={{fontSize:'12px',color:'var(--muted)',display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                      {batch?(
                        <span style={{padding:'1px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:600,
                          background:`${BATCH_COLOR[batch.batch_type]??'var(--cyan)'}18`,
                          color:BATCH_COLOR[batch.batch_type]??'var(--cyan)'}}>
                          {batch.name}
                        </span>
                      ):(
                        <span style={{padding:'1px 8px',borderRadius:'10px',fontSize:'10px',
                          background:'rgba(255,255,255,0.06)',color:'var(--muted)'}}>All batches</span>
                      )}
                      {phase&&<span>Phase {String(phase.phase_number)} · </span>}
                      <span>{new Date(s.scheduled_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                      <span>at {new Date(s.scheduled_at as string).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                      <span>· {String(s.duration_minutes??60)} min</span>
                      {hasRoom&&<span style={{color:'var(--cyan)',fontSize:'10px',fontWeight:600}}>📡 Jitsi room ready</span>}
                    </div>
                  </div>

                  <span style={{
                    padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:600,
                    background:cfg.bg,color:cfg.color,flexShrink:0,whiteSpace:'nowrap',
                  }}>{cfg.label}</span>

                  {/* Action buttons */}
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                    {/* Go Live — not started */}
                    {!s.is_live&&!s.is_completed?(
                      <button className="btn btn-success" onClick={()=>goLive(sid)}
                        disabled={busy} style={{fontSize:'12px',padding:'7px 16px',display:'flex',alignItems:'center',gap:'6px'}}>
                        {busy
                          ?<><Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> Creating…</>
                          :<><Radio size={12}/> Go Live</>}
                      </button>
                    ) : null}

                    {/* Live — rejoin + end */}
                    {s.is_live?(
                      <>
                        <button className="btn btn-primary" onClick={()=>rejoinRoom(sid)}
                          disabled={busy} style={{fontSize:'12px',padding:'7px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
                          {busy?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<><ExternalLink size={12}/> Rejoin</>}
                        </button>
                        <button className="btn btn-danger" onClick={()=>endSession(sid)}
                          disabled={busy} style={{fontSize:'12px',padding:'7px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
                          {busy?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<><Square size={12}/> End</>}
                        </button>
                      </>
                    ) : null}

                    {/* Ended */}
                    {s.is_completed?(
                      s.recording_url?(
                        <a href={s.recording_url as string} target="_blank" rel="noreferrer"
                          className="btn btn-ghost" style={{fontSize:'12px',padding:'7px 14px'}}>
                          ▶ Recording
                        </a>
                      ):(
                        <>
                          <button className="btn btn-ghost" onClick={()=>fetchRecording(sid)}
                            disabled={busy} style={{fontSize:'12px',padding:'7px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
                            {busy?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<><RefreshCw size={12}/> Check Recording</>}
                          </button>
                          <button className="btn btn-ghost" onClick={()=>setRecordingId(recordingId===sid?null:sid)}
                            style={{fontSize:'12px',padding:'7px 12px'}}>
                            + Manual URL
                          </button>
                        </>
                      )
                    ) : null}
                  </div>
                </div>

                {/* Manual recording input */}
                {recordingId===sid?(
                  <div style={{marginTop:'12px',display:'flex',gap:'8px'}}>
                    <input className="form-input" style={{flex:1}}
                      placeholder="Paste YouTube / Loom / Drive link…"
                      value={manualUrl} onChange={e=>setManualUrl(e.target.value)}/>
                    <button className="btn btn-primary" onClick={()=>saveManualRecording(sid)}
                      style={{fontSize:'12px',flexShrink:0}}>Save</button>
                    <button className="btn btn-ghost" onClick={()=>{setRecordingId(null);setManualUrl('')}}
                      style={{fontSize:'12px',flexShrink:0}}><X size={13}/></button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {toast?(
        <div style={{position:'fixed',bottom:'20px',right:'20px',zIndex:200,maxWidth:'340px'}}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      ) : null}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </div>
  )
}
