export const runtime = 'edge'

import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/server'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'
import { PROGRAM_META, DEFAULT_PROGRAM_META } from '@/lib/program-meta'
import type { Program } from '@/types/database'

export default async function ProgramsPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const programs = (data ?? []) as Program[]

  return (
    <div style={{ background:'var(--bg)', color:'var(--text)', minHeight:'100vh' }}>
      <div style={{
        position:'fixed',top:0,left:0,right:0,height:'3px',zIndex:100,
        background:'linear-gradient(90deg,transparent 3%,#00d4ff 25%,#3b5bdb 55%,#7c3aed 80%,transparent 97%)',
      }}/>
      <nav style={{
        position:'fixed',top:0,left:0,right:0,zIndex:50,height:'64px',
        padding:'0 40px',display:'flex',alignItems:'center',justifyContent:'space-between',
        background:'rgba(7,8,13,0.85)',backdropFilter:'blur(16px)',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:'10px',textDecoration:'none'}}>
          <Image src="/tivra-logo-no-bg.png" alt="Tivra" width={32} height={32} />
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'16px',letterSpacing:'0.08em',
            background:'linear-gradient(135deg,#00c8f8,#7030d0)',
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
            TIVRA
          </div>
        </Link>
        <div style={{display:'flex',gap:'8px'}}>
          <Link href="/login" style={{fontSize:'13px',color:'rgba(255,255,255,0.6)',textDecoration:'none',
            padding:'8px 18px',borderRadius:'100px',border:'1px solid rgba(255,255,255,0.1)'}}>Login</Link>
          {ENROLLMENT_OPEN ? (
            <Link href="/register" style={{fontSize:'13px',color:'#fff',textDecoration:'none',
              padding:'9px 22px',borderRadius:'100px',fontWeight:700,
              background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)'}}>Enrol</Link>
          ) : (
            <span style={{fontSize:'13px',color:'rgba(255,255,255,0.3)',cursor:'not-allowed',
              padding:'9px 22px',borderRadius:'100px',fontWeight:700,
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}>Enrollments Will Start Soon</span>
          )}
        </div>
      </nav>

      <div style={{paddingTop:'120px',maxWidth:'780px',margin:'0 auto',padding:'120px 40px 80px'}}>
        <div style={{textAlign:'center',marginBottom:'60px'}}>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'clamp(36px,6vw,60px)',
            color:'#fff',letterSpacing:'-0.03em',marginBottom:'14px'}}>
            Our Programmes
          </h1>
          <p style={{fontSize:'17px',color:'rgba(255,255,255,0.5)',maxWidth:'520px',margin:'0 auto'}}>
            Structured, career-focused certification programmes across technology domains.
          </p>
        </div>

        {/* Programme cards — driven entirely by the `programs` table.
            Adding programme #8 means a new DB row, never a new file here. */}
        <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'32px'}}>
          {programs.map(p => {
            const meta = PROGRAM_META[p.slug] ?? DEFAULT_PROGRAM_META
            return (
            <Link key={p.id} href={`/programs/${p.slug}`} style={{textDecoration:'none',display:'block'}}>
              <div style={{
                background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:'18px',padding:'28px',cursor:'pointer',position:'relative',overflow:'hidden',
              }}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',
                  background: `linear-gradient(90deg,${meta.color},#3b5bdb,#7c3aed)`}}/>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'20px',flexWrap:'wrap'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                      <span style={{fontSize:'28px'}}>{meta.icon}</span>
                      <div>
                        <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'20px',color:'#fff'}}>
                          {p.name}
                        </div>
                        {(p.tagline || p.duration_label) && (
                          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>
                            {[p.tagline, p.duration_label].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'10px',fontWeight:700,
                        background: ENROLLMENT_OPEN ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.08)',
                        color: ENROLLMENT_OPEN ? 'var(--green)' : 'rgba(255,255,255,0.45)', marginLeft:'4px'}}>
                        {ENROLLMENT_OPEN ? '● Enrolling Now' : 'Enrollments Will Start Soon'}
                      </span>
                    </div>
                    {p.description && (
                      <p style={{fontSize:'14px',color:'rgba(255,255,255,0.55)',maxWidth:'500px',lineHeight:1.65,marginBottom:'16px'}}>
                        {p.description}
                      </p>
                    )}
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      {[p.duration_label, p.price_inr ? `₹${p.price_inr.toLocaleString('en-IN')}` : 'Revealing Soon'].filter(Boolean).map(t => (
                        <span key={t} style={{padding:'4px 12px',borderRadius:'20px',fontSize:'11px',fontWeight:600,
                          background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.6)'}}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{
                    padding:'12px 22px',borderRadius:'100px',
                    background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                    color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,
                    fontSize:'13px',letterSpacing:'0.04em',whiteSpace:'nowrap',flexShrink:0,
                  }}>View Programme →</div>
                </div>
              </div>
            </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
