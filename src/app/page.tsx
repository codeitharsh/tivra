'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Video, FlaskConical, ClipboardList, Award, MessageCircle,
  Target, FileCheck, MessagesSquare,
  Clock, Plus, ArrowRight,
} from 'lucide-react'
import PublicNav from '@/components/PublicNav'
import ProgrammeStack from '@/components/ProgrammeStack'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(
      new Intl.DateTimeFormat('en-IN', {
        timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', hour12:false,
      }).format(new Date())
    )
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <>{time || '--:--'} IST</>
}

// Section eyebrow — a small mono label with a short calibration tick,
// used instead of a numbered gradient badge.
// The small mark preceding every section label — a slanted parallelogram
// at the same diagonal as the logo's crossbar facet, not a plain line.
function Eyebrow({ label }: { label: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
      <span style={{
        width:'14px', height:'8px', background:'var(--accent)',
        clipPath:'polygon(30% 0, 100% 0, 70% 100%, 0 100%)',
      }}/>
      <span style={{
        fontFamily:'var(--font-mono), monospace', fontSize:'11px',
        letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--muted)',
      }}>{label}</span>
    </div>
  )
}

function SH({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom:'clamp(40px,6vw,64px)' }}>
      <Eyebrow label={eyebrow}/>
      <h2 style={{
        fontFamily:'var(--font-serif), serif', fontWeight:600,
        fontSize:'clamp(1.7rem,4.2vw,3.2rem)',
        lineHeight:1.08, letterSpacing:'-0.02em', color:'var(--text)',
        marginBottom: sub ? '14px' : '0',
      }}>{title}</h2>
      {sub && <p style={{
        fontSize:'clamp(15px,1.6vw,17px)', color:'var(--muted)',
        maxWidth:'560px', lineHeight:1.7, marginTop:'12px',
      }}>{sub}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DATA (content unchanged — presentation only)
// ─────────────────────────────────────────────────────────────

// Trimmed from 8 to the 5 that most directly support the "real careers"
// claim — the rest (progress dashboard, streaks, parent access) are real
// platform features but belong to the product itself, not the pitch for
// why the programme leads somewhere.
const FEATURES = [
  { icon:Video,          title:'Live Instructor Classes',  desc:'Weekly live sessions with a real teacher. Ask questions in real time. Every session recorded for replay inside the platform.' },
  { icon:FlaskConical,   title:'Real Hands-On Projects',    desc:'Practice on actual tools and platforms with guided walkthroughs — not just slides and quizzes.' },
  { icon:ClipboardList,  title:'Weekly Tests',              desc:'Time-gated quizzes released on a schedule to keep your cohort in sync and your understanding sharp.' },
  { icon:Award,          title:'Verified Certificates',     desc:'Auto-issued when you score ≥75% on phase assessments. Each certificate has a unique public verification URL.' },
  { icon:MessageCircle,  title:'Doubt Corner',              desc:'Post questions tagged to specific modules. Your teacher answers directly in the platform — no WhatsApp chaos.' },
]

interface ProgramCard {
  id: string; slug: string; name: string; tagline: string | null; description: string | null
  price_inr: number | null; original_price_inr?: number | null
  duration_label: string | null; learning_outcomes: string[]
}

const FAQS = [
  ['Who are these programmes for?',
   'Students, freshers, and career-switchers targeting roles in tech. No prior experience needed — every programme starts from the fundamentals.'],
  ['What certifications will I receive?',
   'Tivra issues a verified digital certificate for each phase you complete. Cloud programmes also prepare you for official vendor certifications (AWS, etc.).'],
  ['How are live classes conducted?',
   'Sessions are hosted online via our integrated video platform. Each session is recorded and available for replay with automatic attendance tracking.'],
  ['What happens if I fail an assessment?',
   'No stress. Retake after a 24-hour cooldown — unlimited attempts. The platform shows you exactly what to review before trying again.'],
  ['Is the learning self-paced or scheduled?',
   'Both. Notes and recorded content are self-paced. Live classes run weekly on a fixed schedule. Tests unlock on set dates to keep the cohort together.'],
  ['How quickly is my account activated after payment?',
   'Razorpay payments activate your account instantly. Manual payment submissions are verified by our team within 24 hours on working days.'],
  ['Is there a placement guarantee?',
   'We prepare you thoroughly — structured curriculum, real projects, verified certificates, and interview guidance. Placements depend on your effort and the market.'],
]

const TRUST_SIGNALS = [
  { icon:Target,         label:'Industry-aligned curriculum' },
  { icon:Video,          label:'Live instructor-led sessions' },
  { icon:FileCheck,      label:'Verified digital certificates' },
  { icon:MessagesSquare, label:'1-on-1 doubt support' },
]

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [programmes, setProgrammes] = useState<ProgramCard[]>([])
  const pricingRef = useRef<HTMLDivElement>(null)
  const featureRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    fetch('/api/programs').then(r => r.json()).then(d => setProgrammes(d.programs ?? [])).catch(() => {})
  }, [])

  // The pricing section is a single editorial block, not a grid of
  // cards — one reveal on the whole block reads as premium restraint;
  // animating each line individually would feel fussy for this little
  // content.
  useEffect(() => {
    const el = pricingRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.2 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // "Built for real careers" — each row reveals in sequence (index
  // order, not row order) as it scrolls into view, once, then stays.
  useEffect(() => {
    const items = featureRefs.current.filter((el): el is HTMLDivElement => el !== null)
    if (items.length === 0) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{ background:'var(--bg)', color:'var(--text)', overflowX:'hidden' }}>
      <PublicNav/>

      {/* ══════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════ */}
      <section style={{ position:'relative', overflow:'hidden' }}>
        <div className="grid-lines">
          {[20, 40, 60, 80].map(p => (
            <div key={p} className="grid-line" style={{ left: `${p}%` }}/>
          ))}
        </div>

        <div style={{
          maxWidth:'1240px', margin:'0 auto', position:'relative', zIndex:1,
          padding:'clamp(64px,10vw,120px) clamp(20px,4vw,48px) clamp(56px,7vw,88px)',
          display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:'clamp(32px,5vw,64px)',
        }} className="hero-grid">

          <div>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:'8px', marginBottom:'28px',
              padding:'6px 14px', border:'1px solid var(--border)', borderRadius:'var(--radius-pill)',
            }}>
              <span className="pulse-dot pulse-green"/>
              <span style={{
                fontFamily:'var(--font-mono), monospace', fontSize:'11px',
                letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--muted)',
              }}>Professional Tech Training · India</span>
            </div>

            <h1 style={{
              fontFamily:'var(--font-serif), serif', fontWeight:600,
              fontSize:'clamp(3rem,7.5vw,6rem)',
              letterSpacing:'-0.03em', lineHeight:0.98,
              color:'var(--text)', marginBottom:'8px',
            }}>
              Rise beyond<br/>
              <span style={{ fontStyle:'italic', color:'var(--muted)', fontWeight:400 }}>the tutorial.</span>
            </h1>

            <div className="tick-rule tick-rule-accent" style={{ maxWidth:'260px', margin:'28px 0 32px' }}/>

            <p style={{
              fontSize:'clamp(15px,1.7vw,18px)', color:'var(--muted)',
              maxWidth:'520px', lineHeight:1.72, marginBottom:'40px',
            }}>
              Structured programmes taking you from{' '}
              <strong style={{ color:'var(--text)', fontWeight:600 }}>beginner to certified professional</strong>{' '}
              — live instruction, real projects, and industry-recognised credentials.
            </p>

            <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginBottom:'64px' }}>
              {ENROLLMENT_OPEN
                ? <Link href="/register" className="btn btn-primary">Enrol Now</Link>
                : <span className="btn" style={{ background:'var(--card2)', color:'var(--muted2)', cursor:'not-allowed' }}>Enrollments Will Start Soon</span>}
              <a href="#programs" className="btn btn-ghost">Explore Programmes</a>
            </div>

            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'20px',
              paddingTop:'32px', borderTop:'1px solid var(--border)',
            }}>
              {TRUST_SIGNALS.map(f => (
                <div key={f.label} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{
                    width:'32px', height:'32px', borderRadius:'var(--radius-sm)', flexShrink:0,
                    background:'var(--card2)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)',
                  }}><f.icon size={15}/></span>
                  <span style={{ fontSize:'13px', color:'var(--muted)', fontWeight:500 }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instrument readout panel */}
          <div className="hero-readout tv-clip" style={{
            border:'1px solid var(--border)', borderRadius:'var(--radius)',
            padding:'20px', height:'fit-content', background:'var(--card)',
          }}>
            <div style={{
              fontFamily:'var(--font-mono), monospace', fontSize:'10px', letterSpacing:'0.14em',
              textTransform:'uppercase', color:'var(--muted2)', marginBottom:'16px',
            }}>Status</div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'16px' }}>
              <span style={{ fontSize:'12px', color:'var(--muted)' }}>Enrollment</span>
              <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <span className={`pulse-dot ${ENROLLMENT_OPEN ? 'pulse-green' : 'pulse-red'}`}/>
                <span style={{ fontFamily:'var(--font-mono), monospace', fontSize:'12px', color:'var(--text)' }}>
                  {ENROLLMENT_OPEN ? 'OPEN' : 'OPENING SOON'}
                </span>
              </span>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'16px' }}>
              <span style={{ fontSize:'12px', color:'var(--muted)' }}>Programmes</span>
              <span style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'18px', color:'var(--text)' }}>
                {programmes.length > 0 ? programmes.length : '—'}
              </span>
            </div>

            <div className="tick-rule" style={{ margin:'16px 0' }}/>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontSize:'12px', color:'var(--muted)', display:'flex', alignItems:'center', gap:'6px' }}>
                <Clock size={12}/>India Standard Time
              </span>
              <span style={{ fontFamily:'var(--font-mono), monospace', fontSize:'13px', color:'var(--text)' }}>
                <LiveClock/>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 1 — INTRODUCING TIVRA
      ══════════════════════════════════════════════════ */}
      <section style={{
        borderTop:'1px solid var(--border)',
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)',
      }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <Eyebrow label="Introducing Tivra"/>
          <div style={{
            display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',
            gap:'clamp(32px,5vw,80px)', alignItems:'end',
          }} className="about-grid">
            <div>
              <h2 style={{
                fontFamily:'var(--font-serif), serif', fontWeight:600,
                fontSize:'clamp(1.7rem,4vw,3rem)',
                lineHeight:1.1, letterSpacing:'-0.02em', color:'var(--text)', marginBottom:'24px',
              }}>
                Strategy-led learning, delivering results in tech and beyond.
              </h2>
              <p style={{
                fontSize:'clamp(14px,1.5vw,17px)', color:'var(--muted)',
                lineHeight:1.75, marginBottom:'32px', maxWidth:'460px',
              }}>
                Through research, structured curriculum, and live instruction
                we help ambitious students realise their full potential —
                earning credentials that open real doors in the technology industry.
              </p>
              <Link href="/about" className="btn btn-ghost">About Our Platform</Link>
              <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginTop:'32px' }}>
                {[
                  { icon:Video,         t:'Live classes every week, no pre-recorded lectures' },
                  { icon:ClipboardList, t:'Weekly tests keep your knowledge sharp & accountable' },
                  { icon:Award,         t:'Verifiable certificates with unique public URLs' },
                  { icon:MessageCircle, t:'Doubt resolution directly from your teacher' },
                ].map(f => (
                  <div key={f.t} style={{ display:'flex', alignItems:'flex-start', gap:'12px', fontSize:'13px', color:'var(--muted)' }}>
                    <span style={{
                      width:'26px', height:'26px', borderRadius:'var(--radius-sm)', flexShrink:0,
                      background:'var(--card2)', border:'1px solid var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', marginTop:'1px',
                    }}><f.icon size={13}/></span>
                    <span style={{ paddingTop:'4px' }}>{f.t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div className="tv-clip" style={{ borderRadius:'var(--radius)', overflow:'hidden', aspectRatio:'438/280', border:'1px solid var(--border)' }}>
                <img
                  src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090123_74be96d4-9c1b-40cf-932a-96f4f4babed3.png&w=1280&q=85"
                  alt="Tivra learning" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', filter:'grayscale(0.15)' }}
                />
              </div>
              <div className="tv-clip" style={{ borderRadius:'var(--radius)', overflow:'hidden', aspectRatio:'900/420', border:'1px solid var(--border)' }}>
                <img
                  src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090133_c157d30b-a99a-4477-bec1-a446149ec3f2.png&w=1280&q=85"
                  alt="Tech education" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', filter:'grayscale(0.15)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 2 — WHY TIVRA (editorial chapters, not a grid)
      ══════════════════════════════════════════════════ */}
      <section style={{
        borderTop:'1px solid var(--border)',
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px) clamp(24px,4vw,40px)',
        overflow:'hidden',
      }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <SH eyebrow="Why Tivra" title="Built for real careers"
            sub="Not another MOOC. Five reasons every programme is built to end somewhere real."
          />
        </div>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          {FEATURES.map((f, i) => {
            const fromLeft = i % 2 === 0
            return (
              <div key={f.title}
                ref={el => { featureRefs.current[i] = el }}
                className={`feature-item ${fromLeft ? 'from-left' : 'from-right'}`}
                style={{
                  position:'relative',
                  padding:'clamp(36px,6vw,60px) 0',
                  borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border)' : 'none',
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                <span aria-hidden="true" className="ghost-num" style={{
                  position:'absolute', top:'50%', transform:'translateY(-50%)',
                  left:  fromLeft ? 'clamp(-8px,-1vw,8px)' : undefined,
                  right: fromLeft ? undefined : 'clamp(-8px,-1vw,8px)',
                  fontFamily:'var(--font-serif), serif', fontWeight:600,
                  fontSize:'clamp(5.5rem,13vw,10.5rem)', lineHeight:1,
                  color:'var(--text)', opacity:0.045, pointerEvents:'none', userSelect:'none',
                }}>{String(i + 1).padStart(2, '0')}</span>

                <div className="feature-copy" style={{
                  position:'relative', maxWidth:'540px',
                  marginLeft:  fromLeft ? '0' : 'auto',
                  marginRight: fromLeft ? 'auto' : '0',
                }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:'10px', marginBottom:'18px',
                    flexDirection: fromLeft ? 'row' : 'row-reverse',
                  }} className="feature-meta">
                    <span style={{
                      width:'34px', height:'34px', borderRadius:'var(--radius-sm)', flexShrink:0,
                      background:'var(--card2)', border:'1px solid var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)',
                    }} className="tv-clip-sm"><f.icon size={16}/></span>
                    <span style={{
                      fontFamily:'var(--font-mono), monospace', fontSize:'11px', color:'var(--muted2)',
                      letterSpacing:'0.08em',
                    }}>{String(i + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}</span>
                  </div>
                  <div className="feature-title" style={{
                    fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'clamp(1.4rem,3vw,2rem)',
                    color:'var(--text)', letterSpacing:'-0.01em', marginBottom:'12px', transition:'color 0.2s ease',
                  }}>{f.title}</div>
                  <div style={{ fontSize:'14px', color:'var(--muted)', lineHeight:1.75 }}>{f.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3 — PROGRAMMES (pinned stack, GSAP ScrollTrigger)
      ══════════════════════════════════════════════════ */}
      <section id="programs" style={{ borderTop:'1px solid var(--border)' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px) clamp(32px,5vw,56px)' }}>
          <SH eyebrow="Our Programmes" title="Learning paths for every domain"
            sub="Structured, career-focused programmes across cloud, full-stack, DevOps, data, and more. Each built around live instruction and real outcomes."
          />
        </div>
        <ProgrammeStack programmes={programmes}/>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4 — PRICING (editorial statement, no cards)
      ══════════════════════════════════════════════════ */}
      <section id="pricing" style={{
        borderTop:'1px solid var(--border)',
        padding:'clamp(88px,11vw,160px) clamp(20px,4vw,48px)',
      }}>
        <div ref={pricingRef} className="reveal" style={{ maxWidth:'640px', margin:'0 auto', textAlign:'center' }}>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <Eyebrow label="Pricing"/>
          </div>
          <h2 style={{
            fontFamily:'var(--font-serif), serif', fontWeight:600,
            fontSize:'clamp(1.9rem,4.4vw,3rem)', color:'var(--text)',
            letterSpacing:'-0.02em', lineHeight:1.1, marginBottom:'26px',
          }}>
            Simple, fair pricing.
          </h2>
          <p style={{
            fontSize:'clamp(15px,1.7vw,18px)', color:'var(--muted)',
            lineHeight:1.8, marginBottom:'56px',
          }}>
            Every learner&apos;s journey is different. We keep pricing transparent,
            one-time, and tied directly to the outcomes we deliver — no
            subscriptions, no hidden tiers, no upsells along the way. Explore
            each programme to see exactly what&apos;s included before you decide.
          </p>

          <div className="tick-rule" style={{ maxWidth:'140px', margin:'0 auto 56px' }}/>

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'32px',
            textAlign:'left', marginBottom:'56px',
          }} className="pricing-steps">
            {[
              ['01', 'Choose a programme', 'Every programme lists its full price up front — no calls, no quotes, no back-and-forth.'],
              ['02', 'Pay once, in full', 'A single payment covers the entire programme duration. Nothing recurring, ever.'],
              ['03', 'Nothing else to pay', 'Live classes, notes, tests, and your certificate are included from day one.'],
            ].map(([n, t, d]) => (
              <div key={n}>
                <div style={{ fontFamily:'var(--font-mono), monospace', fontSize:'11px', color:'var(--accent)', letterSpacing:'0.1em', marginBottom:'10px' }}>{n}</div>
                <div style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'15px', color:'var(--text)', marginBottom:'6px' }}>{t}</div>
                <div style={{ fontSize:'13px', color:'var(--muted)', lineHeight:1.6 }}>{d}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize:'13px', color:'var(--muted2)', lineHeight:1.75, maxWidth:'480px', margin:'0 auto 40px' }}>
            If cost is standing between you and a programme, reach out — we work
            with students and institutions on scholarships and partnerships on
            a case-by-case basis at{' '}
            <a href="mailto:contact@tivra.in" style={{ color:'var(--muted)', textDecoration:'underline' }}>contact@tivra.in</a>.
          </p>

          <Link href="/programs" style={{
            display:'inline-flex', alignItems:'center', gap:'8px',
            fontFamily:'var(--font-sans), sans-serif', fontWeight:600, fontSize:'14px',
            color:'var(--text)', textDecoration:'none',
            borderBottom:'1px solid var(--border2)', paddingBottom:'3px',
          }}>
            Explore Programmes <ArrowRight size={14}/>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 5 — FAQ
      ══════════════════════════════════════════════════ */}
      <section id="faq" style={{ borderTop:'1px solid var(--border)', padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)' }}>
        <div style={{ maxWidth:'780px', margin:'0 auto' }}>
          <SH eyebrow="FAQ" title="Common questions"/>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {FAQS.map(([q, a], i) => (
              <div key={i} style={{ borderTop:'1px solid var(--border)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                  width:'100%', padding:'20px 4px', cursor:'pointer',
                  background:'none', border:'none', color:'var(--text)',
                  fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'16px',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  textAlign:'left', gap:'12px',
                }}>
                  <span>{q}</span>
                  <Plus size={18} style={{
                    color:'var(--accent)', flexShrink:0,
                    transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition:'transform 0.25s ease',
                  }}/>
                </button>
                {openFaq === i && (
                  <div style={{ padding:'0 4px 20px', fontSize:'14px', color:'var(--muted)', lineHeight:1.72, maxWidth:'620px' }}>
                    {a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════════════ */}
      <section style={{ padding:'0 clamp(20px,4vw,48px) clamp(64px,8vw,120px)' }}>
        <div style={{
          maxWidth:'1200px', margin:'0 auto', background:'var(--card)', border:'1px solid var(--border)',
          borderRadius:'var(--radius)', padding:'clamp(40px,5vw,72px) clamp(24px,4vw,60px)',
          display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:'32px',
          position:'relative', overflow:'hidden',
        }} className="cta-banner tv-clip">
          <div className="tick-rule" style={{ position:'absolute', top:0, left:0, right:0 }}/>
          <div>
            <div style={{
              fontFamily:'var(--font-mono), monospace', fontSize:'11px',
              letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--muted2)', marginBottom:'14px',
            }}>Start Today</div>
            <h2 style={{
              fontFamily:'var(--font-serif), serif', fontWeight:600,
              fontSize:'clamp(1.8rem,4vw,2.8rem)', color:'var(--text)',
              letterSpacing:'-0.02em', lineHeight:1.08, marginBottom:'12px',
            }}>
              Ready to <span style={{ color:'var(--accent)' }}>rise beyond</span>?
            </h2>
            <p style={{ fontSize:'clamp(14px,1.5vw,16px)', color:'var(--muted)', maxWidth:'480px', lineHeight:1.7 }}>
              Enrol in a Tivra programme today and start building the skills that
              tech employers actually want — with live instruction, real projects,
              and a certificate you can verify.
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', flexShrink:0 }}>
            {ENROLLMENT_OPEN
              ? <Link href="/register" className="btn btn-primary">Enrol Now</Link>
              : <span className="btn" style={{ background:'var(--card2)', color:'var(--muted2)', cursor:'not-allowed' }}>Enrollments Will Start Soon</span>}
            <a href="#programs" className="btn btn-ghost">View Programmes</a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <footer style={{ borderTop:'1px solid var(--border)', padding:'40px clamp(20px,4vw,48px)' }}>
        <div style={{
          maxWidth:'1200px', margin:'0 auto', display:'grid',
          gridTemplateColumns:'1fr 1fr 1fr', gap:'32px', alignItems:'start',
        }} className="footer-grid">
          <div>
            <Link href="/" style={{ display:'flex', alignItems:'center', gap:'9px', textDecoration:'none', marginBottom:'12px' }}>
              <span style={{ fontFamily:'var(--font-serif), serif', fontWeight:600, fontSize:'17px', color:'var(--text)' }}>Tivra</span>
            </Link>
            <div style={{ fontSize:'12px', color:'var(--muted2)', lineHeight:1.7 }}>
              Career-focused tech training for the next generation of engineers.
            </div>
            <div style={{ marginTop:'14px', fontSize:'12px', color:'var(--muted2)', display:'flex', alignItems:'center', gap:'6px' }}>
              <Clock size={11}/><LiveClock/>
            </div>
          </div>

          <div>
            <div style={{
              fontSize:'11px', fontFamily:'var(--font-mono), monospace', letterSpacing:'0.12em',
              textTransform:'uppercase', color:'var(--muted2)', marginBottom:'14px',
            }}>Programmes</div>
            {[['Cloud LaunchPad','/programs'],['Cloud Architect','/programs'],['Full Stack Dev','/programs'],['DevOps & CI/CD','/programs']].map(([l,h]) => (
              <Link key={l} href={h} style={{ display:'block', fontSize:'13px', color:'var(--muted)', textDecoration:'none', marginBottom:'8px' }}>{l}</Link>
            ))}
          </div>

          <div>
            <div style={{
              fontSize:'11px', fontFamily:'var(--font-mono), monospace', letterSpacing:'0.12em',
              textTransform:'uppercase', color:'var(--muted2)', marginBottom:'14px',
            }}>Company</div>
            {[['About','/about'],['Programs','/programs'],['Contact','/contact'],['Terms','/terms'],['Privacy','/privacy']].map(([l,h]) => (
              <Link key={l} href={h} style={{ display:'block', fontSize:'13px', color:'var(--muted)', textDecoration:'none', marginBottom:'8px' }}>{l}</Link>
            ))}
          </div>
        </div>

        <div style={{
          maxWidth:'1200px', margin:'24px auto 0', paddingTop:'20px', borderTop:'1px solid var(--border)',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          fontSize:'11px', color:'var(--muted2)', flexWrap:'wrap', gap:'8px',
        }}>
          <span>© 2026 Tivra EdTech · All rights reserved</span>
          <span>Made in India</span>
        </div>
      </footer>

      <style>{`
        .prog-card:hover { transform: translateY(-3px); border-color: var(--border2) !important; }

        .feature-item {
          opacity: 0;
          transition: opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        .feature-item.from-left  { transform: translateX(-32px); }
        .feature-item.from-right { transform: translateX(32px); }
        .feature-item.visible { opacity: 1; transform: translateX(0); }
        .feature-item:hover .feature-title { color: var(--accent); }

        @media (max-width: 1023px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-readout { max-width: 340px; }
        }
        @media (max-width: 767px) {
          .about-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .cta-banner { grid-template-columns: 1fr !important; }
          .pricing-steps { grid-template-columns: 1fr !important; gap: 28px !important; }
          .feature-copy { margin-left: 0 !important; margin-right: 0 !important; }
          .feature-meta { flex-direction: row !important; }
          .ghost-num { font-size: 4.25rem !important; }
        }
      `}</style>
    </div>
  )
}
