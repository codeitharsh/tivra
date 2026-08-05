export const runtime = 'edge'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import PublicNav from '@/components/PublicNav'
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
      <PublicNav/>

      <div style={{ maxWidth:'880px', margin:'0 auto', padding:'clamp(56px,8vw,88px) clamp(20px,4vw,40px) 80px' }}>
        <div style={{ marginBottom:'56px' }}>
          <div style={{
            fontFamily:'var(--font-mono), monospace', fontSize:'11px', letterSpacing:'0.16em',
            textTransform:'uppercase', color:'var(--muted)', marginBottom:'16px',
          }}>Programmes</div>
          <h1 style={{
            fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'clamp(2.2rem,5.5vw,3.4rem)',
            color:'var(--text)', letterSpacing:'-0.02em', lineHeight:1.06, marginBottom:'16px',
          }}>
            Learning paths for every domain.
          </h1>
          <p style={{ fontSize:'16px', color:'var(--muted)', maxWidth:'540px', lineHeight:1.7 }}>
            Structured, career-focused certification programmes across technology domains —
            each built around live instruction and real outcomes.
          </p>
        </div>

        {/* Programme cards — driven entirely by the `programs` table.
            Adding programme #8 means a new DB row, never a new file here. */}
        <div style={{ display:'flex', flexDirection:'column' }}>
          {programs.map(p => {
            const meta = PROGRAM_META[p.slug] ?? DEFAULT_PROGRAM_META
            const priceLabel = p.price_inr ? `₹${p.price_inr.toLocaleString('en-IN')}` : 'Revealing Soon'
            return (
              <Link key={p.id} href={`/programs/${p.slug}`} className="program-row" style={{
                textDecoration:'none', display:'block', borderTop:'1px solid var(--border)',
                padding:'28px 4px', transition:'background 0.15s ease',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'24px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:'16px', flex:1, minWidth:'260px' }}>
                    <span style={{
                      width:'40px', height:'40px', borderRadius:'var(--radius-sm)', flexShrink:0,
                      background:'var(--card2)', border:'1px solid var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center', color:meta.color,
                    }}><meta.icon size={18}/></span>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', marginBottom:'4px' }}>
                        <span style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'19px', color:'var(--text)' }}>
                          {p.name}
                        </span>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:'5px',
                          padding:'2px 9px', borderRadius:'var(--radius-pill)', fontSize:'10px', fontWeight:700,
                          fontFamily:'var(--font-mono), monospace', textTransform:'uppercase',
                          background: ENROLLMENT_OPEN ? 'var(--green-dim)' : 'var(--card2)',
                          color: ENROLLMENT_OPEN ? 'var(--green)' : 'var(--muted2)',
                        }}>
                          {ENROLLMENT_OPEN && <span className="pulse-dot pulse-green"/>}
                          {ENROLLMENT_OPEN ? 'Enrolling' : 'Coming Soon'}
                        </span>
                      </div>
                      {(p.tagline || p.duration_label) && (
                        <div style={{ fontSize:'12px', color:'var(--muted2)', marginBottom:'10px' }}>
                          {[p.tagline, p.duration_label].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {p.description && (
                        <p style={{ fontSize:'14px', color:'var(--muted)', maxWidth:'520px', lineHeight:1.65, marginBottom:'12px' }}>
                          {p.description}
                        </p>
                      )}
                      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        {[p.duration_label, priceLabel].filter(Boolean).map(t => (
                          <span key={t} style={{
                            padding:'3px 10px', borderRadius:'var(--radius-pill)', fontSize:'11px', fontWeight:600,
                            background:'var(--card2)', border:'1px solid var(--border)', color:'var(--muted)',
                            fontFamily:'var(--font-mono), monospace',
                          }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:'8px',
                    fontFamily:'var(--font-sans), sans-serif', fontWeight:600, fontSize:'13px',
                    color:'var(--text)', whiteSpace:'nowrap', flexShrink:0, paddingTop:'8px',
                  }}>
                    View Programme <ArrowRight size={14}/>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <style>{`
        .program-row:hover { background: rgba(255,255,255,0.02); }
      `}</style>
    </div>
  )
}
