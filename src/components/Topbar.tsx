'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Settings, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface TopbarProps { title: string; subtitle?: string }

interface Notification {
  id: string; title: string; body: string | null
  type: string; is_read: boolean; link: string | null; created_at: string
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const [showNotifs, setShowNotifs]   = useState(false)
  const [notifs,     setNotifs]       = useState<Notification[]>([])
  const [unread,     setUnread]       = useState(0)
  const [loading,    setLoading]      = useState(false)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchNotifs()
  }, [])

  async function fetchNotifs() {
    setLoading(true)
    try {
      const { data } = await sb
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      const list = (data ?? []) as Notification[]
      setNotifs(list)
      setUnread(list.filter(n => !n.is_read).length)
    } catch { /* notifications table may not exist yet */ }
    setLoading(false)
  }

  async function markRead(id: string) {
    await sb.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (!ids.length) return
    await sb.from('notifications').update({ is_read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  const typeColor: Record<string, string> = {
    success: 'var(--green)', warning: 'var(--amber)', info: 'var(--cyan)',
  }

  return (
    <header style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '0 28px', height: '60px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'16px',
          color:'#fff', lineHeight:1 }}>{title}</h1>
        {subtitle && <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{subtitle}</p>}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'8px', position:'relative' }}>
        {/* Notification bell */}
        <button onClick={() => { setShowNotifs(v => !v); if (!showNotifs) fetchNotifs() }}
          style={{
            width:'34px', height:'34px', borderRadius:'8px',
            background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', color:'var(--muted)', position:'relative',
          }}>
          <Bell size={15}/>
          {unread > 0 && (
            <span style={{
              position:'absolute', top:'4px', right:'4px',
              width:'16px', height:'16px', borderRadius:'50%',
              background:'var(--red)', color:'#fff',
              fontSize:'9px', fontWeight:700, fontFamily:'Syne,sans-serif',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 0 6px rgba(239,68,68,0.6)',
            }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </button>

        {/* Notifications panel */}
        {showNotifs && (
          <>
            <div onClick={() => setShowNotifs(false)} style={{
              position:'fixed', inset:0, zIndex:40,
            }}/>
            <div style={{
              position:'absolute', top:'42px', right:0, width:'320px',
              background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'12px', zIndex:50, boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
              overflow:'hidden',
            }}>
              <div style={{
                padding:'14px 16px', borderBottom:'1px solid var(--border)',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'14px' }}>
                  Notifications {unread > 0 && <span style={{ color:'var(--red)', fontSize:'12px' }}>({unread})</span>}
                </span>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  {unread > 0 && (
                    <button onClick={markAllRead} style={{
                      background:'none', border:'none', cursor:'pointer',
                      fontSize:'11px', color:'var(--cyan)',
                    }}>Mark all read</button>
                  )}
                  <button onClick={() => setShowNotifs(false)} style={{
                    background:'none', border:'none', cursor:'pointer', color:'var(--muted)',
                  }}><X size={14}/></button>
                </div>
              </div>

              <div style={{ maxHeight:'360px', overflowY:'auto' }}>
                {loading ? (
                  <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:'13px' }}>
                    Loading…
                  </div>
                ) : notifs.length === 0 ? (
                  <div style={{ padding:'32px', textAlign:'center' }}>
                    <div style={{ fontSize:'28px', marginBottom:'8px' }}>🔔</div>
                    <div style={{ fontSize:'13px', color:'var(--muted)' }}>No notifications yet</div>
                  </div>
                ) : notifs.map(n => (
                  <div key={n.id}
                    onClick={() => { markRead(n.id); if (n.link) window.location.href = n.link }}
                    style={{
                      padding:'12px 16px', cursor:n.link ? 'pointer' : 'default',
                      background: n.is_read ? 'transparent' : 'rgba(59,91,219,0.06)',
                      borderBottom:'1px solid rgba(255,255,255,0.04)',
                      display:'flex', gap:'10px', alignItems:'flex-start',
                      transition:'background 0.15s',
                    }}>
                    <div style={{
                      width:'8px', height:'8px', borderRadius:'50%', flexShrink:0, marginTop:'5px',
                      background: n.is_read ? 'transparent' : (typeColor[n.type] ?? 'var(--cyan)'),
                    }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'13px', fontWeight: n.is_read ? 400 : 600, marginBottom:'2px' }}>
                        {n.title}
                      </div>
                      {n.body && <div style={{ fontSize:'12px', color:'var(--muted)', lineHeight:1.4 }}>{n.body}</div>}
                      <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.25)', marginTop:'4px' }}>
                        {new Date(n.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Settings */}
        <Link href="/profile" style={{
          width:'34px', height:'34px', borderRadius:'8px',
          background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', color:'var(--muted)', textDecoration:'none',
        }}>
          <Settings size={15}/>
        </Link>
      </div>
    </header>
  )
}
