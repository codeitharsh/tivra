'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Plus, X, Video, Radio,
  Square, ExternalLink, RefreshCw, Globe, PlayCircle, Clock, Link2,
} from 'lucide-react'

interface Batch { id: string; name: string; batch_type: string; status: string }

interface Props {
  sessions: Record<string, unknown>[]
  phases:   Record<string, unknown>[]
  batches:  Batch[]
}

const BATCH_META: Record<string, { color: string; bg: string }> = {
  open:      { color: 'var(--accent-2)', bg: 'rgba(23,174,224,0.14)'  },
  college:   { color: '#c3b1ea',         bg: 'rgba(167,139,218,0.16)' },
  corporate: { color: 'var(--amber)',    bg: 'var(--amber-dim)'       },
  custom:    { color: '#a9c0e8',         bg: 'rgba(107,143,209,0.16)' },
}
const batchMeta = (type: string) => BATCH_META[type] ?? BATCH_META.open

// all writes go through /api/live-session — no direct Supabase client needed

async function callLiveApi(action: string, sessionId: string, extra?: Record<string,unknown>) {
  const res = await fetch('/api/live-session', {
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
    batch_id:'', date:'', time:'', duration:'60', meetingLink:'',
  })

  const showToast = (msg:string,type:'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000)
  }

  const selectedPhase = phases.find(p=>p.id===form.phase_id) as {modules?:Record<string,unknown>[]}|undefined
  const phaseModules  = (selectedPhase?.modules??[]) as Record<string,unknown>[]

  async function createSession() {
    if (!form.title||!form.date||!form.time){showToast('Title, date, and time required','error');return}
    if (!form.meetingLink.trim()){showToast('Paste your Teams meeting link','error');return}
    const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString()
    start(async()=>{
      const res  = await callLiveApi('schedule_session', '', {
        title:           form.title,
        description:     form.description||null,
        phaseId:         form.phase_id||null,
        moduleId:        form.module_id||null,
        batchId:         form.batch_id||null,
        scheduledAt,
        durationMinutes: Number(form.duration),
        meetingLink:     form.meetingLink.trim(),
      })
      const data = await res.json() as {error?:string}
      if(!res.ok){showToast(data.error??'Failed to schedule','error');return}
      showToast('✓ Class scheduled!','success')
      setForm({title:'',description:'',phase_id:'',module_id:'',batch_id:'',date:'',time:'',duration:'60',meetingLink:''})
      setShowForm(false)
      router.refresh()
    })
  }

  async function goLive(sessionId:string) {
    setActionId(sessionId)
    start(async()=>{
      try {
        const res  = await callLiveApi('go_live', sessionId)
        const data = await res.json() as {error?:string;joinUrl?:string}

        if(!res.ok || !data.joinUrl) {
          showToast(data.error ?? `Server error (${res.status})`, 'error')
          setActionId(null); return
        }

        window.open(data.joinUrl,'_blank','noopener,noreferrer')
        showToast('🔴 Live! Teams opened in a new tab — students can now join.','success')
        router.refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        showToast(`Connection error: ${msg}`, 'error')
      }
      setActionId(null)
    })
  }

  function rejoinRoom(joinUrl: string | null) {
    if (!joinUrl) { showToast('No meeting link set for this session','error'); return }
    window.open(joinUrl,'_blank','noopener,noreferrer')
  }

  async function endSession(sessionId:string) {
    if(!confirm('End this session?')) return
    setActionId(sessionId)
    start(async()=>{
      await callLiveApi('end_session', sessionId)
      showToast('✓ Session ended.','success')
      setActionId(null)
      router.refresh()
    })
  }

  async function fetchRecording(sessionId:string) {
    setActionId(sessionId)
    start(async()=>{
      const res  = await callLiveApi('fetch_recording', sessionId)
      const data = await res.json() as {recordings?:unknown[];error?:string}
      if(data.recordings?.length) showToast(`✓ Recording found!`,'success')
      else showToast('No recording — use Manual URL below','error')
      setActionId(null)
      router.refresh()
    })
  }

  async function saveManualRecording(sessionId:string) {
    if(!manualUrl.trim()) return
    start(async()=>{
      const res  = await callLiveApi('save_recording', sessionId, { recordingUrl: manualUrl.trim() })
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
    live:     {label:'Live now',      color:'var(--green)',bg:'var(--green-dim)'},
    starting: {label:'Starting soon', color:'var(--amber)',bg:'var(--amber-dim)'},
    upcoming: {label:'Scheduled',     color:'var(--muted)',bg:'rgba(255,255,255,0.06)'},
    ended:    {label:'Ended',         color:'var(--muted)',bg:'rgba(255,255,255,0.04)'},
    missed:   {label:'Missed',        color:'var(--red)',  bg:'var(--red-dim)'},
  }

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',color:'var(--muted)'}}>
          Uses your own <span style={{color:'var(--accent-2)',fontWeight:600}}>Microsoft Teams</span>
          {' '}— paste your meeting link when scheduling
        </div>
        <button className="btn btn-primary" onClick={()=>setShowForm(v=>!v)} style={{fontSize:'13px'}}>
          {showForm?<><X size={14}/> Cancel</>:<><Plus size={14}/> Schedule class</>}
        </button>
      </div>

      {/* Schedule form */}
      {showForm?(
        <div className="card" style={{marginBottom:'20px',padding:'24px',border:'1px solid var(--accent-ring)'}}>
          <div style={{fontFamily:'var(--font-serif)',fontWeight:600,fontSize:'15px',marginBottom:'18px'}}>
            Schedule new class
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px'}}>
            <div style={{gridColumn:'span 2'}}>
              <label className="form-label">Class title *</label>
              <input className="form-input" placeholder="e.g. IAM & Security — Week 3"
                value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
            </div>

            <div style={{gridColumn:'span 2'}}>
              <label className="form-label">Teams meeting link *</label>
              <input className="form-input" type="url" placeholder="https://teams.microsoft.com/l/meetup-join/…"
                value={form.meetingLink} onChange={e=>setForm(f=>({...f,meetingLink:e.target.value}))}/>
              <div style={{fontSize:'11px',color:'var(--muted)',marginTop:'5px'}}>
                Create the meeting in your own Microsoft Teams first, then paste its join link here.
              </div>
            </div>

            {/* Batch pills */}
            <div style={{gridColumn:'span 2'}}>
              <label className="form-label">Batch *</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <button type="button" onClick={()=>setForm(f=>({...f,batch_id:''}))} style={{
                  padding:'8px 16px',borderRadius:'var(--radius-pill)',cursor:'pointer',
                  fontSize:'12px',fontWeight:600,fontFamily:'var(--font-sans)',
                  border:form.batch_id===''?'1px solid var(--accent-ring)':'1px solid var(--border)',
                  background:form.batch_id===''?'var(--accent-2-dim)':'rgba(255,255,255,0.04)',
                  color:form.batch_id===''?'var(--accent-2)':'var(--muted)',
                  display:'flex',alignItems:'center',gap:'6px',
                }}><Globe size={12}/> All batches</button>
                {batches.map(b=>{
                  const meta = batchMeta(b.batch_type)
                  return (
                  <button key={b.id} type="button" onClick={()=>setForm(f=>({...f,batch_id:b.id}))} style={{
                    padding:'8px 16px',borderRadius:'var(--radius-pill)',cursor:'pointer',
                    fontSize:'12px',fontWeight:600,fontFamily:'var(--font-sans)',
                    border:form.batch_id===b.id?`1px solid ${meta.color}`:'1px solid var(--border)',
                    background:form.batch_id===b.id?meta.bg:'rgba(255,255,255,0.04)',
                    color:form.batch_id===b.id?meta.color:'var(--muted)',
                    display:'flex',alignItems:'center',gap:'6px',
                  }}>
                    <span style={{width:'6px',height:'6px',borderRadius:'50%',background:meta.color,flexShrink:0}}/>
                    {b.name}
                  </button>
                  )
                })}
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
            <Video size={14} style={{flexShrink:0,color:'var(--accent-2)'}}/>
            <span style={{fontSize:'13px'}}>
              Students only see this link after Tivra checks they&apos;re in the right batch and
              programme — same as before. Once a student has the link though, it works like any
              Teams link: consider turning on Teams&apos; own lobby / &quot;people in my org
              only&quot; setting for extra protection against it being forwarded outside Tivra.
            </span>
          </div>

          <button className="btn btn-primary" onClick={createSession} disabled={isPending}
            style={{marginTop:'16px',fontSize:'13px',padding:'11px 24px'}}>
            {isPending
              ?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Scheduling…</>
              :<><Video size={14}/> Schedule class</>}
          </button>
        </div>
      ) : null}

      {/* Sessions list */}
      {sessions.length===0?(
        <div className="card" style={{textAlign:'center',padding:'48px',color:'var(--muted)'}}>
          <Video size={28} color="var(--muted2)" style={{marginBottom:'12px'}}/>
          <div style={{fontSize:'14px',marginBottom:'16px'}}>No sessions scheduled yet.</div>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)} style={{fontSize:'13px'}}>
            <Plus size={13}/> Schedule first class
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
            const joinUrl = (s.join_url as string | null) ?? null

            return (
              <div key={sid} className="card" style={{padding:'18px 20px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:'14px',flexWrap:'wrap'}}>
                  {/* Live pulse dot */}
                  {st==='live' ? (
                    <div className="pulse-dot pulse-green" style={{marginTop:'6px'}}/>
                  ) : (
                    <div style={{
                      width:'8px',height:'8px',borderRadius:'50%',flexShrink:0,marginTop:'6px',
                      background:st==='starting'?'var(--amber)':st==='missed'?'var(--red)':'rgba(255,255,255,0.2)',
                    }}/>
                  )}

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'var(--font-serif)',fontWeight:600,fontSize:'14px',marginBottom:'4px'}}>
                      {String(s.title??'')}
                    </div>
                    <div style={{fontSize:'12px',color:'var(--muted)',display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                      {batch?(
                        <span className="pill" style={{
                          background:batchMeta(batch.batch_type).bg,
                          color:batchMeta(batch.batch_type).color}}>
                          {batch.name}
                        </span>
                      ):(
                        <span className="pill" style={{background:'rgba(255,255,255,0.06)',color:'var(--muted)'}}>All batches</span>
                      )}
                      {phase&&<span>Phase {String(phase.phase_number)} · </span>}
                      <span>{new Date(s.scheduled_at as string).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                      <span>at {new Date(s.scheduled_at as string).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                      <span>· {String(s.duration_minutes??60)} min</span>
                      {joinUrl&&<span style={{color:'var(--accent-2)',fontSize:'10px',fontWeight:600,display:'inline-flex',alignItems:'center',gap:'3px'}}><Link2 size={10}/> Link set</span>}
                    </div>
                  </div>

                  <span className="pill" style={{background:cfg.bg,color:cfg.color,flexShrink:0,whiteSpace:'nowrap'}}>
                    {st==='starting' && <Clock size={11}/>} {cfg.label}
                  </span>

                  {/* Action buttons */}
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                    {/* Go Live — not started */}
                    {!s.is_live&&!s.is_completed?(
                      <button className="btn btn-success" onClick={()=>goLive(sid)}
                        disabled={busy} style={{fontSize:'12px',padding:'7px 16px',display:'flex',alignItems:'center',gap:'6px'}}>
                        {busy
                          ?<><Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> Going live…</>
                          :<><Radio size={12}/> Go live</>}
                      </button>
                    ) : null}

                    {/* Live — rejoin + end */}
                    {s.is_live?(
                      <>
                        <button className="btn btn-primary" onClick={()=>rejoinRoom(joinUrl)}
                          style={{fontSize:'12px',padding:'7px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
                          <ExternalLink size={12}/> Rejoin
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
                          className="btn btn-ghost" style={{fontSize:'12px',padding:'7px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
                          <PlayCircle size={12}/> Recording
                        </a>
                      ):(
                        <>
                          <button className="btn btn-ghost" onClick={()=>fetchRecording(sid)}
                            disabled={busy} style={{fontSize:'12px',padding:'7px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
                            {busy?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<><RefreshCw size={12}/> Check recording</>}
                          </button>
                          <button className="btn btn-ghost" onClick={()=>setRecordingId(recordingId===sid?null:sid)}
                            style={{fontSize:'12px',padding:'7px 12px'}}>
                            <Plus size={12}/> Manual URL
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
                      placeholder="Paste YouTube / Loom / Drive / Teams recording link…"
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
      `}</style>
    </div>
  )
}
