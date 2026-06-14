import Link from 'next/link'
import Image from 'next/image'

export default function CloudLaunchpadPage() {
  const phase1 = [
    ['1','Intro to Cloud Computing','Cloud fundamentals, history, IaaS/PaaS/SaaS'],
    ['2','AWS Global Infrastructure','Regions, AZs, Edge Locations'],
    ['3','IAM & Shared Responsibility','Users, groups, roles, policies, MFA'],
    ['4','EC2 & Compute Services','Instance types, pricing, AMIs, security groups'],
    ['5','Storage — S3 & EBS','Storage classes, lifecycle, versioning, EBS'],
    ['6','Database — RDS & DynamoDB','Relational vs NoSQL, read replicas'],
    ['7','Networking & VPC','Subnets, route tables, IGW, NAT, peering'],
    ['8','Monitoring & Security','CloudWatch, CloudTrail, GuardDuty'],
    ['9','AWS Pricing & Billing','Cost Explorer, Budgets, Savings Plans'],
    ['10','Cost Optimisation','Reserved instances, Spot, rightsizing'],
    ['11','Exam Prep','Full mock test, tips, certification guidance'],
  ]
  const phase2 = [
    ['1','EC2 Advanced & Auto Scaling','Launch templates, ASG, scaling policies'],
    ['2','Load Balancers & HA','ALB, NLB, GLB, target groups'],
    ['3','Serverless','Lambda, API Gateway, concurrency'],
    ['4','Advanced Storage','S3 replication, Transfer Acceleration, FSx'],
    ['5','Hybrid Connectivity','VPN, Direct Connect, Transit Gateway'],
    ['6','Route 53 & DNS','Latency, weighted, failover routing'],
    ['7','CloudFront & CDN','Origins, behaviors, Global Accelerator'],
    ['8','Advanced IAM & Security','Permission boundaries, WAF, KMS, Shield'],
    ['9','Migration & DR','7 Rs, DMS, RTO/RPO, DR patterns'],
    ['10','Architecture Patterns','Well-Architected pillars, microservices'],
    ['11','Exam Prep','Mock test, exam-day strategy'],
  ]
  const faqs = [
    ['Who is this for?','Engineering students, freshers, and career-switchers. No prior cloud experience needed.'],
    ['What certifications?','AWS industry certifications (Phase 1) + AWS professional certifications Associate (Phase 2).'],
    ['Are classes live or recorded?','Live weekly sessions, all recorded and available for replay on the platform.'],
    ['What if I fail an assessment?','You can retake after a 24-hour cooldown. No limit on retakes.'],
    ['How long is the programme?','6 months total — 3 months per phase.'],
    ['Is it self-paced?','Content and notes are self-paced. Live classes run on a weekly schedule.'],
  ]

  return (
    <div style={{ background:'var(--bg)', color:'var(--text)', minHeight:'100vh', overflowX:'hidden' }}>
      <div style={{
        position:'fixed',top:0,left:0,right:0,height:'3px',zIndex:100,
        background:'linear-gradient(90deg,transparent 3%,#00d4ff 25%,#3b5bdb 55%,#7c3aed 80%,transparent 97%)',
      }}/>

      {/* Nav */}
      <nav style={{
        position:'fixed',top:0,left:0,right:0,zIndex:50,height:'64px',
        padding:'0 40px',display:'flex',alignItems:'center',justifyContent:'space-between',
        background:'rgba(7,8,13,0.85)',backdropFilter:'blur(16px)',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:'10px',textDecoration:'none'}}>
          <Image src="/tivra-logo.png" alt="Tivra" width={32} height={32}
            style={{borderRadius:'8px',objectFit:'cover'}}/>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'16px',letterSpacing:'0.08em',
            background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
            TIVRA
          </div>
        </Link>
        <div style={{display:'flex',gap:'8px'}}>
          <Link href="/login" style={{fontSize:'13px',color:'rgba(255,255,255,0.6)',textDecoration:'none',
            padding:'8px 18px',borderRadius:'100px',border:'1px solid rgba(255,255,255,0.1)'}}>
            Login
          </Link>
          <Link href="/register" style={{fontSize:'13px',color:'#fff',textDecoration:'none',
            padding:'9px 22px',borderRadius:'100px',fontWeight:700,
            background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)'}}>
            Enrol Now
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        paddingTop:'120px',paddingBottom:'80px',
        textAlign:'center',position:'relative',overflow:'hidden',
      }}>
        <div style={{
          position:'absolute',inset:0,pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(59,91,219,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,91,219,0.05) 1px,transparent 1px)',
          backgroundSize:'60px 60px',
        }}/>
        <div style={{position:'absolute',top:'20%',left:'50%',transform:'translateX(-50%)',
          width:'600px',height:'300px',
          background:'radial-gradient(ellipse,rgba(59,91,219,0.1) 0%,transparent 70%)',
          pointerEvents:'none'}}/>

        <div style={{position:'relative',zIndex:1,maxWidth:'800px',margin:'0 auto',padding:'0 40px'}}>
          <div style={{
            display:'inline-flex',alignItems:'center',gap:'8px',
            padding:'5px 14px',borderRadius:'100px',
            background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',
            marginBottom:'24px',
          }}>
            <span style={{width:'6px',height:'6px',borderRadius:'50%',
              background:'#00d4ff',boxShadow:'0 0 6px #00d4ff'}}/>
            <span style={{fontSize:'11px',color:'#00d4ff',fontFamily:'Space Mono,monospace',
              letterSpacing:'0.12em',textTransform:'uppercase'}}>
              Now Enrolling
            </span>
          </div>

          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,
            fontSize:'clamp(40px,7vw,76px)',color:'#fff',
            letterSpacing:'-0.03em',lineHeight:0.92,marginBottom:'20px'}}>
            Cloud LaunchPad
          </h1>
          <div style={{
            fontFamily:'DM Sans,sans-serif',fontWeight:300,
            fontSize:'clamp(16px,2.5vw,22px)',
            color:'rgba(255,255,255,0.45)',letterSpacing:'0.02em',marginBottom:'28px',
          }}>
            AWS industry certifications → professional certifications Associate
          </div>

          <p style={{fontSize:'17px',color:'rgba(255,255,255,0.55)',
            maxWidth:'560px',margin:'0 auto 40px',lineHeight:1.7}}>
            A structured 6-month programme with live classes, weekly tests,
            hands-on labs, and verified certificates — designed for
            Indian engineering students and freshers.
          </p>

          <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap',marginBottom:'56px'}}>
            <Link href="/register" style={{
              padding:'14px 32px',borderRadius:'100px',
              background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
              color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,
              fontSize:'14px',letterSpacing:'0.05em',textTransform:'uppercase',
              textDecoration:'none',boxShadow:'0 6px 28px rgba(59,91,219,0.4)',
            }}>
              Enrol Now →
            </Link>
            <a href="#curriculum" style={{
              padding:'14px 32px',borderRadius:'100px',
              border:'1px solid rgba(255,255,255,0.12)',
              background:'rgba(255,255,255,0.04)',
              color:'rgba(255,255,255,0.7)',fontFamily:'DM Sans,sans-serif',
              fontWeight:500,fontSize:'14px',textDecoration:'none',
            }}>
              View Curriculum ↓
            </a>
          </div>

          {/* Quick stats */}
          <div style={{
            display:'inline-flex',gap:'0',
            background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:'14px',overflow:'hidden',
          }}>
            {[
              {num:'6 months',label:'Duration'},
              {num:'24+',label:'Modules'},
              {num:'2',label:'Certifications'},
              {num:'75%',label:'Pass mark'},
            ].map((s,i) => (
              <div key={s.label} style={{
                padding:'16px 24px',textAlign:'center',
                borderRight:i<3?'1px solid rgba(255,255,255,0.07)':'none',
              }}>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'18px',
                  background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
                  WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                  {s.num}
                </div>
                <div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',
                  letterSpacing:'0.08em',textTransform:'uppercase',marginTop:'4px'}}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section style={{padding:'80px 40px',background:'rgba(255,255,255,0.015)'}}>
        <div style={{maxWidth:'1000px',margin:'0 auto'}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'32px',
            color:'#fff',textAlign:'center',marginBottom:'40px',letterSpacing:'-0.02em'}}>
            What&apos;s included
          </h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'14px'}}>
            {[
              {icon:'🎥',t:'Live Weekly Classes',d:'Instructor-led sessions every week'},
              {icon:'📄',t:'Study Notes PDF',d:'Uploaded per module by your teacher'},
              {icon:'📋',t:'Weekly Tests',d:'Time-gated quizzes every week'},
              {icon:'🎯',t:'Phase Assessments',d:'60–75 MCQs to earn your certificate'},
              {icon:'🏆',t:'Verified Certificates',d:'Auto-issued with unique verify URL'},
              {icon:'💬',t:'Doubt Corner',d:'Post questions, get teacher answers'},
              {icon:'📊',t:'Progress Dashboard',d:'Track every module, test, and session'},
              {icon:'🔄',t:'Retake Policy',d:'Fail → retake after 24hrs, unlimited tries'},
            ].map(f => (
              <div key={f.t} style={{
                padding:'20px',borderRadius:'12px',
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{fontSize:'24px',marginBottom:'10px'}}>{f.icon}</div>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'14px',
                  color:'#fff',marginBottom:'4px'}}>{f.t}</div>
                <div style={{fontSize:'12px',color:'rgba(255,255,255,0.45)'}}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section id="curriculum" style={{padding:'80px 40px'}}>
        <div style={{maxWidth:'780px',margin:'0 auto'}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'32px',
            color:'#fff',textAlign:'center',marginBottom:'40px',letterSpacing:'-0.02em'}}>
            Full Curriculum
          </h2>

          {/* Phase 1 */}
          <div style={{marginBottom:'32px'}}>
            <div style={{
              padding:'14px 20px',borderRadius:'10px 10px 0 0',
              background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',
              display:'flex',alignItems:'center',gap:'12px',
            }}>
              <span style={{fontFamily:'Space Mono,monospace',fontSize:'10px',color:'#f59e0b',
                letterSpacing:'0.12em',textTransform:'uppercase'}}>Phase 1</span>
              <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',color:'#fff'}}>
                AWS industry certifications
              </span>
              <span style={{marginLeft:'auto',fontSize:'12px',color:'rgba(255,255,255,0.35)'}}>
                11 modules · 3 months · 60Q final exam
              </span>
            </div>
            <div style={{border:'1px solid rgba(255,255,255,0.07)',borderTop:'none',
              borderRadius:'0 0 10px 10px',overflow:'hidden'}}>
              {phase1.map(([n,t,d],i) => (
                <div key={n} style={{
                  display:'flex',gap:'14px',alignItems:'flex-start',
                  padding:'13px 20px',
                  background:i%2===0?'transparent':'rgba(255,255,255,0.02)',
                  borderBottom:i<phase1.length-1?'1px solid rgba(255,255,255,0.04)':'none',
                }}>
                  <div style={{
                    width:'26px',height:'26px',borderRadius:'7px',flexShrink:0,
                    background:'rgba(245,158,11,0.1)',display:'flex',alignItems:'center',
                    justifyContent:'center',fontFamily:'Syne,sans-serif',fontWeight:800,
                    fontSize:'10px',color:'#f59e0b',
                  }}>{n}</div>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:600,color:'#fff',marginBottom:'2px'}}>{t}</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 2 */}
          <div>
            <div style={{
              padding:'14px 20px',borderRadius:'10px 10px 0 0',
              background:'rgba(0,212,255,0.06)',border:'1px solid rgba(0,212,255,0.18)',
              display:'flex',alignItems:'center',gap:'12px',
            }}>
              <span style={{fontFamily:'Space Mono,monospace',fontSize:'10px',color:'#00d4ff',
                letterSpacing:'0.12em',textTransform:'uppercase'}}>Phase 2</span>
              <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',color:'#fff'}}>
                professional certifications Associate
              </span>
              <span style={{marginLeft:'auto',fontSize:'12px',color:'rgba(255,255,255,0.35)'}}>
                11 modules · 3 months · 75Q final exam
              </span>
            </div>
            <div style={{border:'1px solid rgba(255,255,255,0.07)',borderTop:'none',
              borderRadius:'0 0 10px 10px',overflow:'hidden'}}>
              {phase2.map(([n,t,d],i) => (
                <div key={n} style={{
                  display:'flex',gap:'14px',alignItems:'flex-start',
                  padding:'13px 20px',
                  background:i%2===0?'transparent':'rgba(255,255,255,0.02)',
                  borderBottom:i<phase2.length-1?'1px solid rgba(255,255,255,0.04)':'none',
                }}>
                  <div style={{
                    width:'26px',height:'26px',borderRadius:'7px',flexShrink:0,
                    background:'rgba(0,212,255,0.08)',display:'flex',alignItems:'center',
                    justifyContent:'center',fontFamily:'Syne,sans-serif',fontWeight:800,
                    fontSize:'10px',color:'#00d4ff',
                  }}>{n}</div>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:600,color:'#fff',marginBottom:'2px'}}>{t}</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{padding:'80px 40px',background:'rgba(255,255,255,0.015)'}}>
        <div style={{maxWidth:'700px',margin:'0 auto'}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'32px',
            color:'#fff',textAlign:'center',marginBottom:'36px',letterSpacing:'-0.02em'}}>
            FAQ
          </h2>
          <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
            {faqs.map(([q,a],i) => (
              <details key={i} style={{
                background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:'10px',overflow:'hidden',
              }}>
                <summary style={{padding:'16px 20px',cursor:'pointer',listStyle:'none',
                  fontFamily:'Syne,sans-serif',fontWeight:600,fontSize:'14px',color:'#fff',
                  display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  {q}
                  <span style={{color:'rgba(0,212,255,0.7)',fontSize:'18px',flexShrink:0,marginLeft:'10px'}}>+</span>
                </summary>
                <div style={{padding:'0 20px 16px',fontSize:'14px',
                  color:'rgba(255,255,255,0.55)',lineHeight:1.7}}>{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:'80px 40px',textAlign:'center'}}>
        <div style={{maxWidth:'600px',margin:'0 auto'}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'clamp(28px,5vw,44px)',
            color:'#fff',letterSpacing:'-0.03em',marginBottom:'14px'}}>
            Ready to launch?
          </h2>
          <p style={{fontSize:'16px',color:'rgba(255,255,255,0.5)',marginBottom:'32px'}}>
            Register today. Our team will activate your account within 24 hours.
          </p>
          <Link href="/register" style={{
            display:'inline-flex',alignItems:'center',gap:'8px',
            padding:'15px 36px',borderRadius:'100px',
            background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
            color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,
            fontSize:'15px',letterSpacing:'0.05em',textDecoration:'none',
            boxShadow:'0 8px 32px rgba(59,91,219,0.45)',
          }}>
            Enrol in Cloud LaunchPad →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,0.07)',padding:'32px 40px',
        textAlign:'center'}}>
        <div style={{fontSize:'12px',color:'rgba(255,255,255,0.2)'}}>
          © 2026 Tivra · <Link href="/" style={{color:'inherit',textDecoration:'none'}}>Home</Link>
          {' · '}<Link href="/programs" style={{color:'inherit',textDecoration:'none'}}>All Programmes</Link>
        </div>
      </footer>
    </div>
  )
}
