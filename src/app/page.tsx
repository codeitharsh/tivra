'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Clock, Menu, X, ChevronDown } from 'lucide-react'

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
  return <>{time} IST</>
}

function StarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor">
      <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"/>
    </svg>
  )
}

// Pill button with text-roll + rotating arrow
function Btn({ text, href = '#', variant = 'primary', size = 'md', onClick }:{
  text:string; href?:string; variant?:'primary'|'outline'|'ghost'; size?:'sm'|'md'|'lg'; onClick?:()=>void
}) {
  const bg: Record<string,string> = {
    primary:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
    outline:'transparent',
    ghost:'rgba(255,255,255,0.06)',
  }
  const border: Record<string,string> = {
    primary:'none',
    outline:'1px solid rgba(255,255,255,0.18)',
    ghost:'1px solid rgba(255,255,255,0.08)',
  }
  const textH = size==='lg'?'20px':size==='md'?'18px':'16px'
  const fs    = size==='lg'?'15px':size==='md'?'14px':'13px'
  const px    = size==='lg'?'26px':size==='md'?'22px':'16px'
  const py    = size==='lg'?'14px':size==='md'?'12px':'9px'
  const ic    = size==='lg'?'32px':size==='md'?'28px':'24px'
  const sh    = variant==='primary' ? '0 6px 28px rgba(59,91,219,0.4)' : 'none'
  const inner = (
    <>
      <span style={{overflow:'hidden', height:textH, display:'block'}}>
        <span className="btn-roll" style={{
          display:'flex', flexDirection:'column',
          transition:'transform 0.5s cubic-bezier(0.25,0.1,0.25,1)',
        }}>
          <span>{text}</span>
          <span style={{height:textH, display:'block'}}>{text}</span>
        </span>
      </span>
      <span className="btn-arrow" style={{
        width:ic, height:ic, borderRadius:'50%',
        background: variant==='primary' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
        display:'flex', alignItems:'center', justifyContent:'center',
        transform:'rotate(-45deg)',
        transition:'transform 0.5s cubic-bezier(0.25,0.1,0.25,1)',
        flexShrink:0,
      }}>
        <ArrowRight size={variant==='primary'?13:12} strokeWidth={2.5}/>
      </span>
    </>
  )
  const baseStyle: React.CSSProperties = {
    display:'inline-flex', alignItems:'center', gap:'10px',
    padding:`${py} ${py} ${py} ${px}`,
    borderRadius:'100px', textDecoration:'none', cursor:'pointer',
    fontSize:fs, fontWeight:700, letterSpacing:'0.02em',
    background:bg[variant], border:border[variant], color:'#fff',
    boxShadow:sh, transition:'all 0.3s', outline:'none',
  }
  if (href === '#') {
    return <button onClick={onClick} className="tivra-btn" style={baseStyle}>{inner}</button>
  }
  return <Link href={href} className="tivra-btn" style={baseStyle}>{inner}</Link>
}

// Eyebrow label used across sections
function Eyebrow({ n, label }:{ n:string; label:string }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'22px'}}>
      <div style={{
        width:'24px', height:'24px', borderRadius:'50%',
        background:'linear-gradient(135deg,#00d4ff,#3b5bdb)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'10px', fontWeight:800, color:'#fff', flexShrink:0,
      }}>{n}</div>
      <span style={{
        fontFamily:'Space Mono,monospace', fontSize:'11px',
        letterSpacing:'0.18em', textTransform:'uppercase',
        color:'rgba(255,255,255,0.35)',
      }}>{label}</span>
    </div>
  )
}

// Section heading
function SH({ eyebrow, n='·', title, sub }:{
  eyebrow:string; n?:string; title:React.ReactNode; sub?:string
}) {
  return (
    <div style={{marginBottom:'clamp(40px,6vw,72px)'}}>
      <Eyebrow n={n} label={eyebrow}/>
      <h2 style={{
        fontFamily:'Syne,sans-serif', fontWeight:800,
        fontSize:'clamp(1.7rem,4.5vw,3.6rem)',
        lineHeight:1.05, letterSpacing:'-0.03em', color:'#fff',
        marginBottom: sub ? '14px' : '0',
      }}>{title}</h2>
      {sub && <p style={{
        fontSize:'clamp(15px,1.6vw,18px)', color:'rgba(255,255,255,0.45)',
        maxWidth:'520px', lineHeight:1.7, marginTop:'12px',
      }}>{sub}</p>}
    </div>
  )
}

// Ambient canvas dots
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if(!c) return
    const ctx = c.getContext('2d'); if(!ctx) return
    let W = c.width=window.innerWidth, H = c.height=window.innerHeight, raf=0
    const pts = Array.from({length:50},()=>({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.4+0.3,
      vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25,
      a:Math.random()*.4+.1, h:Math.random()>.5?190:265,
    }))
    const draw=()=>{
      ctx.clearRect(0,0,W,H)
      pts.forEach(p=>{
        p.x=(p.x+p.vx+W)%W; p.y=(p.y+p.vy+H)%H
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.fillStyle=`hsla(${p.h},100%,70%,${p.a})`; ctx.fill()
      })
      raf=requestAnimationFrame(draw)
    }
    draw()
    const resize=()=>{W=c.width=window.innerWidth;H=c.height=window.innerHeight}
    window.addEventListener('resize',resize)
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize)}
  },[])
  return <canvas ref={ref} style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',opacity:.55}}/>
}

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  {icon:'🎥', title:'Live Instructor Classes',   desc:'Weekly live sessions with a real teacher. Ask questions in real time. Every session recorded for replay inside the platform.'},
  {icon:'🧪', title:'Real Hands-On Projects',     desc:'Practice on actual tools and platforms with guided walkthroughs — not just slides and quizzes.'},
  {icon:'📋', title:'Weekly Tests',               desc:'Time-gated quizzes released on a schedule to keep your cohort in sync and your understanding sharp.'},
  {icon:'🏆', title:'Verified Certificates',      desc:'Auto-issued when you score ≥75% on phase assessments. Each certificate has a unique public verification URL.'},
  {icon:'💬', title:'Doubt Corner',               desc:'Post questions tagged to specific modules. Your teacher answers directly in the platform — no WhatsApp chaos.'},
  {icon:'📊', title:'Progress Dashboard',         desc:'Module completion, test scores, attendance, and login streak — everything tracked in one place.'},
  {icon:'🔥', title:'Daily Streak System',        desc:'Build a study habit. Consecutive login streaks tracked with milestone rewards at 7, 14, and 30 days.'},
  {icon:'👨‍👩‍👧', title:'Parent Access',            desc:'Dedicated read-only accounts for parents to track their child\'s progress, test scores, and attendance.'},
]

const PROGRAMMES = [
  {
    id:'cloud-launchpad', num:'01',
    name:'Cloud LaunchPad',
    tag:'AWS Cloud Certifications',
    duration:'2 months', modules:11,
    price:'₹6,999',
    color:'#00d4ff', colorRgb:'0,212,255',
    status:'enrolling',
    desc:'From zero cloud knowledge to AWS Cloud Practitioner certified — live classes, hands-on labs, weekly tests, and a verified certificate.',
    features:['AWS Cloud Practitioner prep','11 structured modules','Live weekly classes','Weekly tests & phase assessment','Verified certificate on passing'],
  },
  {
    id:'cloud-architect', num:'02',
    name:'Cloud Architect',
    tag:'AWS Solutions Architect',
    duration:'4 months', modules:12,
    price:'₹9,999',
    color:'#7c3aed', colorRgb:'124,58,237',
    status:'soon',
    desc:'Advanced cloud architecture, AWS Solutions Architect Associate certification — for engineers who want to design scalable production systems.',
    features:['AWS SAA-C03 prep','12 advanced modules','Live weekly classes','Architecture labs & projects','Verified certificate on passing'],
  },
  {
    id:'fullstack', num:'03',
    name:'Full Stack Dev',
    tag:'Web Development',
    duration:'4 months', modules:14,
    price:'Coming 2025',
    color:'#f59e0b', colorRgb:'245,158,11',
    status:'planned',
    desc:'Modern full-stack web development — React, Node.js, databases, deployment — from building your first component to shipping real products.',
    features:['React & Node.js from scratch','14 project-based modules','Portfolio-worthy capstone','Industry code reviews','Completion certificate'],
  },
  {
    id:'devops', num:'04',
    name:'DevOps & CI/CD',
    tag:'Infrastructure & Automation',
    duration:'3 months', modules:10,
    price:'Coming 2025',
    color:'#22c55e', colorRgb:'34,197,94',
    status:'planned',
    desc:'Containers, pipelines, and deployment automation — Docker, Kubernetes, GitHub Actions, and production-grade infrastructure practices.',
    features:['Docker & Kubernetes','CI/CD pipelines','Infrastructure as Code','10 hands-on modules','Completion certificate'],
  },
]

const CLOUD_MODULES = [
  ['01','Intro to Cloud & Computing Concepts','Cloud models, history, IaaS/PaaS/SaaS, economics'],
  ['02','AWS Global Infrastructure',          'Regions, AZs, edge locations, global backbone'],
  ['03','IAM & Security Fundamentals',        'Users, groups, roles, policies, MFA, shared responsibility'],
  ['04','Compute — EC2 & Pricing Models',     'Instance types, AMIs, purchase options, security groups'],
  ['05','Storage — S3, EBS & Glacier',        'Storage classes, lifecycle, versioning, encryption'],
  ['06','Databases — RDS & DynamoDB',         'Relational vs NoSQL, read replicas, DynamoDB basics'],
  ['07','Networking & VPC Fundamentals',      'Subnets, route tables, IGW, NAT, VPC peering'],
  ['08','Monitoring, Logging & Alerting',     'CloudWatch, CloudTrail, GuardDuty, Security Hub'],
  ['09','Billing, Pricing & Cost Management', 'Cost Explorer, Budgets, Savings Plans, TCO Calculator'],
  ['10','Cost Optimisation Strategies',       'Reserved instances, Spot, rightsizing, Trusted Advisor'],
  ['11','Certification Prep & Mock Tests',    'Full mock exam, exam tips, certification registration guide'],
]

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

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const [openFaq,    setOpenFaq]    = useState<number|null>(null)

  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>30)
    window.addEventListener('scroll',h); return()=>window.removeEventListener('scroll',h)
  },[])
  useEffect(()=>{
    document.body.style.overflow=mobileOpen?'hidden':''; return()=>{document.body.style.overflow=''}
  },[mobileOpen])

  return (
    <div style={{background:'#07080c', color:'#fff', overflowX:'hidden', fontFamily:'DM Sans, sans-serif'}}>

      {/* ── Top accent line ── */}
      <div style={{
        position:'fixed', top:0, left:0, right:0, height:'2px', zIndex:100,
        background:'linear-gradient(90deg,transparent 3%,#00d4ff 25%,#3b5bdb 55%,#7c3aed 80%,transparent 97%)',
      }}/>

      {/* ══════════════════════════════════════════════════
          NAV
      ══════════════════════════════════════════════════ */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:50,
        padding:'14px 20px 12px',
      }}>
        <div style={{
          maxWidth:'1200px', margin:'0 auto',
          background: scrolled ? 'rgba(7,8,12,0.94)' : 'rgba(7,8,12,0.5)',
          backdropFilter:'blur(24px)',
          border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:'100px',
          padding:'5px 6px 5px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          transition:'all 0.4s',
          boxShadow: scrolled ? '0 8px 40px rgba(0,0,0,0.5)' : 'none',
        }}>

          <Link href="/" style={{display:'flex',alignItems:'center',gap:'9px',textDecoration:'none',flexShrink:0}}>
            <Image src="/tivra-logo.png" alt="Tivra" width={30} height={30}
              style={{borderRadius:'8px',objectFit:'cover'}}/>
            <div>
              <div style={{
                fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'15px',letterSpacing:'0.1em',
                background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
              }}>TIVRA</div>
              <div style={{fontSize:'6.5px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.16em',textTransform:'uppercase',marginTop:'-1px'}}>Rise Beyond</div>
            </div>
          </Link>

          <div className="nav-links" style={{display:'flex',alignItems:'center',gap:'2px'}}>
            {[['Programs','#programs'],['Curriculum','#curriculum'],['Pricing','#pricing'],['FAQ','#faq']].map(([l,h])=>(
              <a key={l} href={h} style={{
                fontSize:'13px',fontWeight:500,color:'rgba(255,255,255,0.5)',
                textDecoration:'none',padding:'7px 13px',borderRadius:'100px',
                transition:'color 0.2s',
              }}>{l}</a>
            ))}
          </div>

          <div className="nav-links" style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'12px',color:'rgba(255,255,255,0.3)'}}>
              <Clock size={11}/><LiveClock/>
            </div>
            <Link href="/login" style={{
              fontSize:'13px',fontWeight:600,color:'rgba(255,255,255,0.55)',
              textDecoration:'none',padding:'7px 16px',borderRadius:'100px',
              border:'1px solid rgba(255,255,255,0.1)',
            }}>Login</Link>
            <Btn text="Enrol Now" href="/register" size="sm"/>
          </div>

          <button onClick={()=>setMobileOpen(v=>!v)} className="mobile-btn" style={{
            display:'none',background:'rgba(255,255,255,0.07)',
            border:'1px solid rgba(255,255,255,0.1)',borderRadius:'50%',
            width:'36px',height:'36px',alignItems:'center',justifyContent:'center',
            cursor:'pointer',color:'#fff',
          }}>
            {mobileOpen ? <X size={17}/> : <Menu size={17}/>}
          </button>
        </div>
      </nav>

      {/* Mobile overlay + drawer */}
      {mobileOpen && <div style={{position:'fixed',inset:0,zIndex:48,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)'}} onClick={()=>setMobileOpen(false)}/>}
      <div style={{
        position:'fixed',bottom:0,left:'10px',right:'10px',zIndex:49,
        background:'#0f1016',border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:'20px 20px 0 0',padding:'28px 22px 44px',
        transform:mobileOpen?'translateY(0)':'translateY(110%)',
        transition:'transform 0.45s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',display:'flex',alignItems:'center',gap:'5px',marginBottom:'24px'}}>
          <Clock size={11}/><LiveClock/>
        </div>
        {[['Programs','#programs'],['Curriculum','#curriculum'],['Pricing','#pricing'],['FAQ','#faq']].map(([l,h])=>(
          <a key={l} href={h} onClick={()=>setMobileOpen(false)} style={{
            display:'block',fontSize:'26px',fontFamily:'Syne,sans-serif',fontWeight:700,
            color:'#fff',textDecoration:'none',padding:'9px 0',
            borderBottom:'1px solid rgba(255,255,255,0.06)',
          }}>{l}</a>
        ))}
        <div style={{marginTop:'22px',display:'flex',gap:'10px'}}>
          <Btn text="Enrol Now" href="/register"/>
          <Link href="/login" style={{
            padding:'10px 20px',borderRadius:'100px',border:'1px solid rgba(255,255,255,0.12)',
            color:'rgba(255,255,255,0.5)',textDecoration:'none',fontSize:'14px',fontWeight:600,
          }}>Login</Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════ */}
      <section style={{
        minHeight:'100vh',position:'relative',
        display:'flex',flexDirection:'column',overflow:'hidden',
      }}>
        {/* Ambient glows */}
        {[
          {x:'-12%',y:'8%',  c:'#00d4ff', s:'700px', d:'0s'},
          {x:'58%', y:'15%', c:'#7c3aed', s:'580px', d:'3s'},
          {x:'22%', y:'58%', c:'#3b5bdb', s:'480px', d:'6s'},
        ].map((g,i)=>(
          <div key={i} style={{
            position:'absolute',left:g.x,top:g.y,width:g.s,height:g.s,
            borderRadius:'50%',
            background:`radial-gradient(circle,${g.c}26,transparent 70%)`,
            filter:'blur(60px)',pointerEvents:'none',zIndex:0,
            animation:`orbFloat 10s ${g.d} ease-in-out infinite`,
          }}/>
        ))}
        {/* Grid */}
        <div style={{
          position:'absolute',inset:0,zIndex:1,pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(59,91,219,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,91,219,0.05) 1px,transparent 1px)',
          backgroundSize:'64px 64px',
          maskImage:'radial-gradient(ellipse 75% 80% at 50% 50%,black,transparent)',
        }}/>
        <Particles/>

        <div style={{height:'110px',flexShrink:0}}/>
        <div style={{flex:1}}/>

        {/* Content — pinned to bottom like Axion */}
        <div style={{
          position:'relative',zIndex:10,
          maxWidth:'1200px',margin:'0 auto',width:'100%',
          padding:'0 clamp(20px,4vw,48px) clamp(64px,8vw,96px)',
        }}>

          {/* Eyebrow */}
          <div style={{
            display:'inline-flex',alignItems:'center',gap:'8px',marginBottom:'28px',
            padding:'5px 14px 5px 8px',
            background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:'100px',
          }}>
            <div style={{
              width:'18px',height:'18px',borderRadius:'50%',
              background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:'8px',fontWeight:800,color:'#fff',
            }}>T</div>
            <span style={{
              fontFamily:'Space Mono,monospace',fontSize:'11px',
              letterSpacing:'0.18em',textTransform:'uppercase',
              color:'rgba(255,255,255,0.4)',
            }}>Professional Tech Training · India</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily:'Syne,sans-serif',fontWeight:800,
            fontSize:'clamp(3rem,9vw,7.5rem)',
            textTransform:'uppercase',letterSpacing:'-0.04em',lineHeight:0.87,
            color:'#fff',marginBottom:'32px',
          }}>
            RISE<br/>
            <span style={{
              fontFamily:'DM Sans,sans-serif',fontStyle:'italic',fontWeight:300,
              fontSize:'0.65em',color:'rgba(255,255,255,0.2)',textTransform:'none',
              letterSpacing:'-0.01em',
            }}>beyond </span>
            <span style={{
              background:'linear-gradient(135deg,#00d4ff 0%,#3b5bdb 45%,#7c3aed 100%)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
            }}>FURTHER</span>
            <span style={{color:'rgba(255,255,255,0.25)'}}>.</span>
          </h1>

          <p style={{
            fontSize:'clamp(15px,1.8vw,19px)',color:'rgba(255,255,255,0.5)',
            maxWidth:'500px',lineHeight:1.72,marginBottom:'40px',fontWeight:300,
          }}>
            Structured programmes taking you from{' '}
            <strong style={{color:'rgba(255,255,255,0.8)',fontWeight:500}}>beginner to certified professional</strong>{' '}
            — live instruction, real projects, and industry-recognised credentials.
          </p>

          {/* CTAs */}
          <div style={{display:'flex',flexWrap:'wrap',gap:'12px',alignItems:'center',marginBottom:'72px'}}>
            <Btn text="Start a programme" href="/register" size="lg"/>
            <Btn text="Explore programmes" href="#programs" variant="outline" size="lg"/>

            {/* Partner pill */}
            <div style={{
              display:'inline-flex',alignItems:'center',gap:'8px',
              padding:'8px 12px 8px 10px',
              background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'12px',
            }}>
              <span style={{color:'#00d4ff',display:'flex'}}><StarIcon size={18}/></span>
              <span style={{fontSize:'13px',fontWeight:600,color:'rgba(255,255,255,0.65)'}}>Certified Partner</span>
              <span style={{
                fontSize:'9px',fontWeight:800,letterSpacing:'0.06em',
                padding:'2px 8px',borderRadius:'100px',
                background:'linear-gradient(135deg,#00d4ff,#3b5bdb)',color:'#fff',
              }}>LIVE</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display:'flex',flexWrap:'wrap',gap:'0',
            paddingTop:'32px',borderTop:'1px solid rgba(255,255,255,0.07)',
          }}>
            {[
              ['4+','Programmes'],
              ['24+','Total modules'],
              ['₹6,999','Starting from'],
              ['75%+','Pass mark'],
            ].map(([n,l],i,arr)=>(
              <div key={l} style={{
                flex:'1 1 110px',padding:'0 24px',
                borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.07)':'none',
              }}>
                <div style={{
                  fontFamily:'Syne,sans-serif',fontWeight:800,
                  fontSize:'clamp(1.3rem,2.8vw,1.9rem)',lineHeight:1,marginBottom:'5px',
                  background:'linear-gradient(135deg,#00d4ff,#3b5bdb)',
                  WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
                }}>{n}</div>
                <div style={{fontSize:'11px',color:'rgba(255,255,255,0.32)',letterSpacing:'0.06em',textTransform:'uppercase'}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 1 — ABOUT / INTRODUCING TIVRA
      ══════════════════════════════════════════════════ */}
      <section style={{
        background:'rgba(255,255,255,0.018)',
        borderTop:'1px solid rgba(255,255,255,0.06)',
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)',
        position:'relative',overflow:'hidden',
      }}>
        <div style={{
          position:'absolute',inset:0,pointerEvents:'none',
          backgroundImage:'radial-gradient(rgba(0,212,255,0.05) 1px,transparent 1px)',
          backgroundSize:'28px 28px',
        }}/>
        <div style={{maxWidth:'1200px',margin:'0 auto',position:'relative',zIndex:1}}>
          <Eyebrow n="1" label="Introducing Tivra"/>
          <div style={{
            display:'grid',
            gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',
            gap:'clamp(32px,5vw,80px)',
            alignItems:'end',
          }} className="about-grid">
            {/* Left */}
            <div>
              <h2 style={{
                fontFamily:'Syne,sans-serif',fontWeight:800,
                fontSize:'clamp(1.7rem,4vw,3.4rem)',
                lineHeight:1.06,letterSpacing:'-0.03em',color:'#fff',marginBottom:'24px',
              }}>
                Strategy-led learning,<br/>
                <span style={{
                  background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
                  WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
                }}>delivering results</span><br/>
                in tech and beyond.
              </h2>
              <p style={{
                fontSize:'clamp(14px,1.5vw,17px)',color:'rgba(255,255,255,0.55)',
                lineHeight:1.75,marginBottom:'32px',maxWidth:'460px',
              }}>
                Through research, structured curriculum, and live instruction
                we help ambitious students realise their full potential —
                earning credentials that open real doors in the technology industry.
              </p>
              <Btn text="About our platform" href="/about" variant="outline"/>
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'32px'}}>
                {[
                  {icon:'🎥',t:'Live classes every week, no pre-recorded lectures'},
                  {icon:'📋',t:'Weekly tests keep your knowledge sharp & accountable'},
                  {icon:'🏆',t:'Verifiable certificates with unique public URLs'},
                  {icon:'💬',t:'Doubt resolution directly from your teacher'},
                ].map(f=>(
                  <div key={f.t} style={{display:'flex',alignItems:'flex-start',gap:'10px',fontSize:'13px',color:'rgba(255,255,255,0.45)'}}>
                    <span style={{
                      width:'28px',height:'28px',borderRadius:'8px',
                      background:'rgba(0,212,255,0.07)',border:'1px solid rgba(0,212,255,0.14)',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:'13px',flexShrink:0,marginTop:'1px',
                    }}>{f.icon}</span>
                    {f.t}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: images stacked */}
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{borderRadius:'20px',overflow:'hidden',aspectRatio:'438/280',border:'1px solid rgba(255,255,255,0.07)'}}>
                <img
                  src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090123_74be96d4-9c1b-40cf-932a-96f4f4babed3.png&w=1280&q=85"
                  alt="Tivra learning" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                />
              </div>
              <div style={{borderRadius:'20px',overflow:'hidden',aspectRatio:'900/420',border:'1px solid rgba(255,255,255,0.07)'}}>
                <img
                  src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090133_c157d30b-a99a-4477-bec1-a446149ec3f2.png&w=1280&q=85"
                  alt="Tech education" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 2 — WHY TIVRA
      ══════════════════════════════════════════════════ */}
      <section style={{
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)',
        position:'relative',overflow:'hidden',
      }}>
        <div style={{
          position:'absolute',right:'-5%',top:'10%',width:'500px',height:'500px',
          borderRadius:'50%',
          background:'radial-gradient(circle,rgba(124,58,237,0.1),transparent 70%)',
          filter:'blur(60px)',pointerEvents:'none',
        }}/>
        <div style={{maxWidth:'1200px',margin:'0 auto',position:'relative',zIndex:1}}>
          <SH n="2" eyebrow="Why Tivra"
            title={<>Built for <span style={{background:'linear-gradient(135deg,#00d4ff,#7c3aed)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>real careers</span></>}
            sub="Not another MOOC. Structured programmes that take you from knowing nothing to certified and employable."
          />
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',
            gap:'14px',
          }}>
            {FEATURES.map(f=>(
              <div key={f.title} style={{
                background:'rgba(255,255,255,0.026)',
                border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:'16px',padding:'24px',
                position:'relative',overflow:'hidden',
                transition:'border-color 0.2s,transform 0.2s',
              }} className="feature-card">
                <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',
                  background:'linear-gradient(90deg,#00d4ff,#7c3aed)'}}/>
                <div style={{fontSize:'26px',marginBottom:'12px'}}>{f.icon}</div>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',color:'#fff',marginBottom:'8px'}}>{f.title}</div>
                <div style={{fontSize:'13px',color:'rgba(255,255,255,0.46)',lineHeight:1.68}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3 — PROGRAMMES
      ══════════════════════════════════════════════════ */}
      <section id="programs" style={{
        background:'rgba(255,255,255,0.018)',
        borderTop:'1px solid rgba(255,255,255,0.06)',
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)',
        position:'relative',overflow:'hidden',
      }}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <SH n="3" eyebrow="Our Programmes"
            title="Learning paths for every domain"
            sub="Structured, career-focused programmes across cloud, full-stack, DevOps, data, and more. Each built around live instruction and real outcomes."
          />

          {/* 2×2 grid of programme cards */}
          <div style={{
            display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'16px',
          }} className="r-grid-2">
            {PROGRAMMES.map(p=>(
              <div key={p.id} style={{
                borderRadius:'20px',overflow:'hidden',
                background:`rgba(${p.colorRgb},0.04)`,
                border:`1px solid rgba(${p.colorRgb},0.14)`,
                position:'relative',
                transition:'all 0.3s cubic-bezier(0.25,0.1,0.25,1)',
              }} className="prog-card">
                {/* Video / header */}
                <div style={{
                  aspectRatio:'16/9',background:`rgba(${p.colorRgb},0.06)`,
                  position:'relative',overflow:'hidden',
                }}>
                  {(p.id==='cloud-launchpad'||p.id==='cloud-architect') ? (
                    <video
                      src={p.id==='cloud-launchpad'
                        ? 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260516_122702_390f5305-8719-41d5-ae80-d23ab3796c28.mp4'
                        : 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260516_123323_f909c2b8-ff6c-4edf-882b-8ebcdbe389b5.mp4'
                      }
                      autoPlay muted loop playsInline
                      style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.6}}
                    />
                  ) : (
                    /* Placeholder gradient for upcoming programmes */
                    <div style={{
                      position:'absolute',inset:0,
                      background:`linear-gradient(135deg,rgba(${p.colorRgb},0.15),rgba(7,8,12,0.6))`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                    }}>
                      <div style={{
                        fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'52px',
                        color:`rgba(${p.colorRgb},0.2)`,letterSpacing:'-0.05em',
                      }}>{p.num}</div>
                    </div>
                  )}
                  <div style={{
                    position:'absolute',inset:0,
                    background:`linear-gradient(to bottom,transparent 40%,rgba(7,8,12,0.7))`,
                  }}/>
                  {/* Status badge */}
                  <div style={{
                    position:'absolute',top:'12px',left:'12px',
                    padding:'3px 10px',borderRadius:'100px',fontSize:'10px',fontWeight:700,
                    letterSpacing:'0.06em',textTransform:'uppercase',
                    background: p.status==='enrolling' ? `rgba(${p.colorRgb},0.25)`
                              : p.status==='soon'      ? 'rgba(245,158,11,0.2)'
                              : 'rgba(255,255,255,0.1)',
                    color: p.status==='enrolling' ? p.color
                         : p.status==='soon'      ? '#f59e0b'
                         : 'rgba(255,255,255,0.4)',
                    border:`1px solid ${p.status==='enrolling'?`rgba(${p.colorRgb},0.4)`:p.status==='soon'?'rgba(245,158,11,0.3)':'rgba(255,255,255,0.15)'}`,
                  }}>
                    {p.status==='enrolling'?'● Enrolling':p.status==='soon'?'Coming Soon':'Planned 2025'}
                  </div>
                  {/* Hover button */}
                  <div className="card-hover-btn" style={{
                    position:'absolute',bottom:'12px',left:'12px',
                    height:'34px',width:'34px',borderRadius:'100px',
                    background:`rgba(${p.colorRgb},0.3)`,backdropFilter:'blur(8px)',
                    border:`1px solid rgba(${p.colorRgb},0.4)`,
                    display:'flex',alignItems:'center',overflow:'hidden',
                    transition:'all 0.3s cubic-bezier(0.25,0.1,0.25,1)',
                    paddingLeft:'10px',gap:'8px',
                  }}>
                    <span className="card-hover-text" style={{
                      fontSize:'12px',fontWeight:600,color:'#fff',whiteSpace:'nowrap',
                      opacity:0,transition:'opacity 0.2s 0.08s',
                    }}>View details</span>
                    <span style={{
                      width:'18px',height:'18px',borderRadius:'50%',
                      background:'rgba(255,255,255,0.18)',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      flexShrink:0,marginLeft:'auto',marginRight:'7px',
                    }}><ArrowRight size={10}/></span>
                  </div>
                </div>

                {/* Card body */}
                <div style={{padding:'20px 22px 24px'}}>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'12px'}}>
                    {[p.duration,`${p.modules} modules`,p.price].map(t=>(
                      <span key={t} style={{
                        fontSize:'11px',fontWeight:600,padding:'3px 10px',borderRadius:'100px',
                        background:`rgba(${p.colorRgb},0.09)`,
                        border:`1px solid rgba(${p.colorRgb},0.18)`,
                        color:p.color,
                      }}>{t}</span>
                    ))}
                  </div>
                  <div style={{
                    fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'17px',color:'#fff',
                    marginBottom:'8px',letterSpacing:'-0.01em',
                  }}>
                    {p.name}
                    <span style={{fontSize:'12px',fontWeight:500,color:'rgba(255,255,255,0.35)',marginLeft:'8px'}}>{p.tag}</span>
                  </div>
                  <p style={{fontSize:'13px',color:'rgba(255,255,255,0.44)',lineHeight:1.62,marginBottom:'14px'}}>{p.desc}</p>
                  <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                    {p.features.map(f=>(
                      <div key={f} style={{display:'flex',gap:'8px',fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>
                        <span style={{color:p.color,flexShrink:0,marginTop:'1px'}}>✓</span>{f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bundle row */}
          <div style={{
            marginTop:'16px',
            background:'linear-gradient(135deg,rgba(0,212,255,0.06),rgba(124,58,237,0.06))',
            border:'1px solid rgba(59,91,219,0.2)',borderRadius:'20px',
            padding:'22px 28px',
            display:'flex',alignItems:'center',justifyContent:'space-between',
            flexWrap:'wrap',gap:'16px',
          }}>
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',marginBottom:'4px'}}>
                🎯 Cloud Bundle — LaunchPad + Architect
              </div>
              <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>
                Both cloud programmes · 6 months total · Save ₹1,999
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
              <div>
                <div style={{
                  fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'22px',
                  background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
                  WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
                }}>₹14,999</div>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)'}}>one-time payment</div>
              </div>
              <Btn text="Enrol in bundle" href="/register" size="sm"/>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4 — CURRICULUM (Cloud LaunchPad)
      ══════════════════════════════════════════════════ */}
      <section id="curriculum" style={{
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)',
        position:'relative',
      }}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <SH n="4" eyebrow="Sample Curriculum"
            title={<>Cloud LaunchPad <span style={{background:'linear-gradient(135deg,#00d4ff,#7c3aed)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Module List</span></>}
            sub="11 modules across 2 months — starting from zero cloud knowledge, ending at AWS Cloud Practitioner certified."
          />

          <div style={{
            border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',overflow:'hidden',
          }}>
            {/* Phase header */}
            <div style={{
              display:'flex',alignItems:'center',gap:'12px',
              padding:'14px 22px',
              background:'rgba(0,212,255,0.07)',
              borderBottom:'1px solid rgba(0,212,255,0.15)',
            }}>
              <span style={{
                fontFamily:'Space Mono,monospace',fontSize:'10px',color:'#00d4ff',
                letterSpacing:'0.14em',textTransform:'uppercase',
              }}>Cloud LaunchPad</span>
              <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'14px',color:'#fff'}}>
                AWS Cloud Practitioner
              </span>
              <span style={{marginLeft:'auto',fontSize:'12px',color:'rgba(255,255,255,0.3)'}}>
                11 modules · 2 months
              </span>
            </div>
            {CLOUD_MODULES.map(([num,title,topics],i)=>(
              <div key={num} style={{
                display:'flex',gap:'16px',alignItems:'flex-start',
                padding:'14px 22px',
                background:i%2===0?'transparent':'rgba(255,255,255,0.018)',
                borderBottom:i<CLOUD_MODULES.length-1?'1px solid rgba(255,255,255,0.04)':'none',
              }}>
                <div style={{
                  width:'28px',height:'28px',borderRadius:'8px',flexShrink:0,
                  background:'rgba(0,212,255,0.1)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'10px',color:'#00d4ff',
                }}>{num}</div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'#fff',marginBottom:'3px'}}>{title}</div>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.36)'}}>{topics}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{marginTop:'20px',textAlign:'center'}}>
            <span style={{fontSize:'13px',color:'rgba(255,255,255,0.3)'}}>
              Cloud Architect, Full Stack, DevOps curricula published when programmes open.
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 5 — PRICING
      ══════════════════════════════════════════════════ */}
      <section id="pricing" style={{
        background:'rgba(255,255,255,0.018)',
        borderTop:'1px solid rgba(255,255,255,0.06)',
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)',
      }}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <SH n="5" eyebrow="Pricing"
            title="Simple, fair pricing"
            sub="One-time payment. Full access for the programme duration. No subscriptions, no hidden fees."
          />
          <div style={{
            display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px',
          }} className="price-grid">

            {/* Cloud LaunchPad */}
            <div style={{
              background:'rgba(0,212,255,0.05)',border:'1px solid rgba(0,212,255,0.2)',
              borderRadius:'20px',padding:'28px',position:'relative',overflow:'hidden',
            }}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,#00d4ff,#3b5bdb)'}}/>
              <div style={{fontSize:'11px',color:'#00d4ff',fontFamily:'Space Mono,monospace',
                letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'10px'}}>Cloud LaunchPad</div>
              <div style={{
                fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'36px',lineHeight:1,
                background:'linear-gradient(135deg,#00d4ff,#3b5bdb)',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
                marginBottom:'4px',
              }}>₹6,999</div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.35)',marginBottom:'20px'}}>
                One-time · 2 months access
              </div>
              {['AWS Cloud Practitioner prep','11 modules + live classes','Weekly tests & assessment',
                'Doubt Corner access','Verified certificate'].map(t=>(
                <div key={t} style={{display:'flex',gap:'8px',fontSize:'13px',color:'rgba(255,255,255,0.6)',marginBottom:'8px'}}>
                  <span style={{color:'#00d4ff',flexShrink:0}}>✓</span>{t}
                </div>
              ))}
              <div style={{marginTop:'24px'}}>
                <Btn text="Enrol Now" href="/register" size="sm"/>
              </div>
            </div>

            {/* Bundle — featured */}
            <div style={{
              background:'rgba(59,91,219,0.12)',border:'1px solid rgba(59,91,219,0.4)',
              borderRadius:'20px',padding:'28px',position:'relative',overflow:'hidden',
              transform:'scale(1.03)',
              boxShadow:'0 20px 60px rgba(59,91,219,0.2)',
            }}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,#00d4ff,#3b5bdb,#7c3aed)'}}/>
              <div style={{
                position:'absolute',top:'16px',right:'16px',
                padding:'3px 10px',borderRadius:'100px',fontSize:'9px',fontWeight:800,
                letterSpacing:'0.08em',textTransform:'uppercase',
                background:'rgba(59,91,219,0.3)',color:'#93c5fd',
              }}>Most Popular</div>
              <div style={{fontSize:'11px',color:'#93c5fd',fontFamily:'Space Mono,monospace',
                letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'10px'}}>Full Bundle</div>
              <div style={{
                fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'36px',lineHeight:1,
                background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
                marginBottom:'4px',
              }}>₹14,999</div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.35)',marginBottom:'20px'}}>
                One-time · 6 months · Save ₹1,999
              </div>
              {['Both cloud programmes','All 23 modules + live classes',
                '2 certification preps','Priority doubt resolution',
                '2 verified certificates'].map(t=>(
                <div key={t} style={{display:'flex',gap:'8px',fontSize:'13px',color:'rgba(255,255,255,0.7)',marginBottom:'8px'}}>
                  <span style={{color:'#22c55e',flexShrink:0}}>✓</span>{t}
                </div>
              ))}
              <div style={{marginTop:'24px'}}>
                <Btn text="Enrol in Bundle" href="/register" size="sm"/>
              </div>
            </div>

            {/* Group / Institution */}
            <div style={{
              background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'20px',padding:'28px',position:'relative',overflow:'hidden',
            }}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,#7c3aed,rgba(255,255,255,0.2))'}}/>
              <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontFamily:'Space Mono,monospace',
                letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'10px'}}>Group / Institution</div>
              <div style={{
                fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'28px',lineHeight:1,
                color:'rgba(255,255,255,0.7)',marginBottom:'4px',
              }}>Contact Us</div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.35)',marginBottom:'20px'}}>
                Custom pricing for institutions
              </div>
              {['Dedicated private batch','Admin-managed enrolment',
                'Full curriculum access','Progress tracking for coordinators',
                'Custom scheduling available'].map(t=>(
                <div key={t} style={{display:'flex',gap:'8px',fontSize:'13px',color:'rgba(255,255,255,0.5)',marginBottom:'8px'}}>
                  <span style={{color:'#22c55e',flexShrink:0}}>✓</span>{t}
                </div>
              ))}
              <div style={{marginTop:'24px'}}>
                <a href="mailto:contact@tivra.in" style={{
                  display:'inline-flex',alignItems:'center',gap:'8px',
                  padding:'9px 16px 9px 20px',borderRadius:'100px',
                  background:'rgba(0,212,255,0.1)',border:'1px solid rgba(0,212,255,0.25)',
                  color:'#00d4ff',fontSize:'13px',fontWeight:700,textDecoration:'none',
                  transition:'all 0.2s',
                }}>
                  contact@tivra.in <ArrowRight size={13}/>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 6 — FAQ
      ══════════════════════════════════════════════════ */}
      <section id="faq" style={{
        padding:'clamp(64px,8vw,120px) clamp(20px,4vw,48px)',
      }}>
        <div style={{maxWidth:'780px',margin:'0 auto'}}>
          <SH n="6" eyebrow="FAQ" title="Common questions"/>
          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
            {FAQS.map(([q,a],i)=>(
              <div key={i} style={{
                background:'rgba(255,255,255,0.026)',
                border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:'12px',overflow:'hidden',
                transition:'border-color 0.2s',
              }}>
                <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{
                  width:'100%',padding:'18px 22px',cursor:'pointer',
                  background:'none',border:'none',color:'#fff',
                  fontFamily:'Syne,sans-serif',fontWeight:600,fontSize:'15px',
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  textAlign:'left',gap:'12px',
                }}>
                  <span>{q}</span>
                  <span style={{
                    color:'rgba(0,212,255,0.7)',fontSize:'20px',flexShrink:0,
                    transform:openFaq===i?'rotate(45deg)':'rotate(0deg)',
                    transition:'transform 0.3s',display:'block',
                  }}>+</span>
                </button>
                {openFaq===i && (
                  <div style={{padding:'0 22px 18px',fontSize:'14px',color:'rgba(255,255,255,0.52)',lineHeight:1.72}}>
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
      <section style={{padding:'0 clamp(20px,4vw,48px) clamp(64px,8vw,120px)'}}>
        <div style={{
          maxWidth:'1200px',margin:'0 auto',
          background:'linear-gradient(135deg,rgba(0,212,255,0.07),rgba(59,91,219,0.08),rgba(124,58,237,0.07))',
          border:'1px solid rgba(59,91,219,0.2)',
          borderRadius:'24px',padding:'clamp(40px,5vw,72px) clamp(24px,4vw,60px)',
          display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:'32px',
          position:'relative',overflow:'hidden',
        }} className="cta-banner">
          <div style={{
            position:'absolute',inset:0,pointerEvents:'none',
            backgroundImage:'linear-gradient(rgba(59,91,219,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(59,91,219,0.06) 1px,transparent 1px)',
            backgroundSize:'40px 40px',
          }}/>
          <div style={{position:'relative',zIndex:1}}>
            <div style={{fontFamily:'Space Mono,monospace',fontSize:'11px',
              letterSpacing:'0.18em',textTransform:'uppercase',
              color:'rgba(255,255,255,0.35)',marginBottom:'14px'}}>
              Start today
            </div>
            <h2 style={{
              fontFamily:'Syne,sans-serif',fontWeight:800,
              fontSize:'clamp(1.8rem,4vw,3.2rem)',color:'#fff',
              letterSpacing:'-0.03em',lineHeight:1.05,marginBottom:'12px',
            }}>
              Ready to{' '}
              <span style={{
                background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
              }}>Rise Beyond</span>?
            </h2>
            <p style={{fontSize:'clamp(14px,1.5vw,17px)',color:'rgba(255,255,255,0.45)',maxWidth:'480px',lineHeight:1.7}}>
              Enrol in a Tivra programme today and start building the skills that
              tech employers actually want — with live instruction, real projects,
              and a certificate you can verify.
            </p>
          </div>
          <div style={{position:'relative',zIndex:1,display:'flex',flexDirection:'column',gap:'10px',flexShrink:0}}>
            <Btn text="Enrol Now" href="/register" size="lg"/>
            <Btn text="View Programmes" href="#programs" variant="outline" size="md"/>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <footer style={{
        borderTop:'1px solid rgba(255,255,255,0.07)',
        padding:'40px clamp(20px,4vw,48px)',
      }}>
        <div style={{
          maxWidth:'1200px',margin:'0 auto',
          display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'32px',
          alignItems:'start',
        }} className="footer-grid">
          <div>
            <Link href="/" style={{display:'flex',alignItems:'center',gap:'9px',textDecoration:'none',marginBottom:'12px'}}>
              <Image src="/tivra-logo.png" alt="Tivra" width={28} height={28}
                style={{borderRadius:'7px',objectFit:'cover'}}/>
              <span style={{
                fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'14px',letterSpacing:'0.1em',
                background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
              }}>TIVRA</span>
            </Link>
            <div style={{fontSize:'12px',color:'rgba(255,255,255,0.25)',lineHeight:1.7}}>
              Career-focused tech training for the next generation of engineers.
            </div>
            <div style={{
              marginTop:'14px',fontSize:'12px',color:'rgba(255,255,255,0.2)',
              display:'flex',alignItems:'center',gap:'5px',
            }}>
              <Clock size={11}/><LiveClock/> · IST
            </div>
          </div>

          <div>
            <div style={{fontSize:'11px',fontFamily:'Space Mono,monospace',
              letterSpacing:'0.14em',textTransform:'uppercase',
              color:'rgba(255,255,255,0.25)',marginBottom:'14px'}}>Programmes</div>
            {[['Cloud LaunchPad','/programs'],['Cloud Architect','/programs'],['Full Stack Dev','/programs'],['DevOps & CI/CD','/programs']].map(([l,h])=>(
              <Link key={l} href={h} style={{display:'block',fontSize:'13px',color:'rgba(255,255,255,0.35)',
                textDecoration:'none',marginBottom:'8px',transition:'color 0.2s'}}>{l}</Link>
            ))}
          </div>

          <div>
            <div style={{fontSize:'11px',fontFamily:'Space Mono,monospace',
              letterSpacing:'0.14em',textTransform:'uppercase',
              color:'rgba(255,255,255,0.25)',marginBottom:'14px'}}>Company</div>
            {[['About','/about'],['Programs','/programs'],['Contact','/contact'],
              ['Terms','/terms'],['Privacy','/privacy'],['Refund Policy','/refund']].map(([l,h])=>(
              <Link key={l} href={h} style={{display:'block',fontSize:'13px',color:'rgba(255,255,255,0.35)',
                textDecoration:'none',marginBottom:'8px'}}>{l}</Link>
            ))}
          </div>
        </div>

        <div style={{
          maxWidth:'1200px',margin:'24px auto 0',
          paddingTop:'20px',borderTop:'1px solid rgba(255,255,255,0.06)',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          fontSize:'11px',color:'rgba(255,255,255,0.2)',flexWrap:'wrap',gap:'8px',
        }}>
          <span>© 2025 Tivra EdTech · All rights reserved</span>
          <span>Made in India 🇮🇳</span>
        </div>
      </footer>

      {/* ── Global animation styles ── */}
      <style>{`
        @keyframes orbFloat {
          0%,100%{transform:translateY(0) scale(1)}
          50%{transform:translateY(-28px) scale(1.04)}
        }
        .tivra-btn:hover .btn-roll { transform: translateY(-50%); }
        .tivra-btn:hover .btn-arrow { transform: rotate(0deg) !important; }
        .tivra-btn:hover { opacity: 0.92; }

        .prog-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 48px rgba(0,0,0,0.35);
        }
        .prog-card:hover .card-hover-btn {
          width: 138px !important;
        }
        .prog-card:hover .card-hover-text {
          opacity: 1 !important;
        }
        .feature-card:hover {
          border-color: rgba(0,212,255,0.2) !important;
          transform: translateY(-2px);
        }

        @media (max-width: 767px) {
          .nav-links { display: none !important; }
          .mobile-btn { display: flex !important; }
          .about-grid { grid-template-columns: 1fr !important; }
          .price-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .cta-banner { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1023px) {
          .price-grid { grid-template-columns: 1fr 1fr !important; }
        }
        nav a:hover { color: rgba(255,255,255,0.9) !important; }
      `}</style>
    </div>
  )
}
