import Link from 'next/link'
import Image from 'next/image'

export default function ProgramsPage() {
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
          <Link href="/register" style={{fontSize:'13px',color:'#fff',textDecoration:'none',
            padding:'9px 22px',borderRadius:'100px',fontWeight:700,
            background:'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)'}}>Enrol</Link>
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
            More programmes launching throughout 2026.
          </p>
        </div>

        {/* Active programmes */}
        <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'32px'}}>

          {/* Cloud LaunchPad */}
          <Link href="/programs/cloud-launchpad" style={{textDecoration:'none',display:'block'}}>
            <div style={{
              background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'18px',padding:'28px',cursor:'pointer',position:'relative',overflow:'hidden',
            }}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',
                background:'linear-gradient(90deg,#00d4ff,#3b5bdb,#7c3aed)'}}/>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'20px',flexWrap:'wrap'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                    <span style={{fontSize:'28px'}}>☁️</span>
                    <div>
                      <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'20px',color:'#fff'}}>
                        Cloud LaunchPad
                      </div>
                      <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>
                        AWS Cloud Certifications · 4 months
                      </div>
                    </div>
                    <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'10px',fontWeight:700,
                      background:'rgba(34,197,94,0.12)',color:'var(--green)',marginLeft:'4px'}}>
                      ● Enrolling Now
                    </span>
                  </div>
                  <p style={{fontSize:'14px',color:'rgba(255,255,255,0.55)',maxWidth:'500px',lineHeight:1.65,marginBottom:'16px'}}>
                    From zero cloud knowledge to AWS Cloud Practitioner certified.
                    Live classes, hands-on labs, weekly tests, and a verified certificate.
                  </p>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {['4 Months','11 Modules','AWS Certification','Live Classes','₹6,999'].map(t => (
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

          {/* Cloud Architect */}
          <Link href="/programs/cloud-architect" style={{textDecoration:'none',display:'block'}}>
            <div style={{
              background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'18px',padding:'28px',cursor:'pointer',position:'relative',overflow:'hidden',
            }}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',
                background:'linear-gradient(90deg,#7c3aed,#3b5bdb,#00d4ff)'}}/>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'20px',flexWrap:'wrap'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                    <span style={{fontSize:'28px'}}>🏗️</span>
                    <div>
                      <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'20px',color:'#fff'}}>
                        Cloud Architect
                      </div>
                      <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>
                        AWS Solutions Architect · 6 months
                      </div>
                    </div>
                    <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'10px',fontWeight:700,
                      background:'rgba(34,197,94,0.12)',color:'var(--green)',marginLeft:'4px'}}>
                      ● Enrolling Now
                    </span>
                  </div>
                  <p style={{fontSize:'14px',color:'rgba(255,255,255,0.55)',maxWidth:'500px',lineHeight:1.65,marginBottom:'16px'}}>
                    Advanced cloud architecture and AWS Solutions Architect Associate certification.
                    For engineers who want to design scalable, production-grade systems.
                  </p>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {['6 Months','12 Modules','AWS SAA-C03','Live Classes','₹9,999'].map(t => (
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
        </div>

        {/* Combined offer */}
        <div style={{
          background:'linear-gradient(135deg,rgba(59,91,219,0.08),rgba(124,58,237,0.06))',
          border:'1px solid rgba(59,91,219,0.2)',
          borderRadius:'18px',padding:'24px 28px',marginBottom:'32px',
          display:'flex',alignItems:'center',gap:'20px',flexWrap:'wrap',
        }}>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'16px',color:'#fff',marginBottom:'6px'}}>
              🎯 Cloud LaunchPad + Cloud Architect Bundle
            </div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.5)'}}>
              Enrol in both programmes together and get the full 10-month journey —
              from Cloud Practitioner to Solutions Architect.
            </div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'24px',
              background:'linear-gradient(135deg,#00d4ff,#7c3aed)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
              ₹14,999
            </div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',marginTop:'2px'}}>
              Save ₹1,999 vs separate
            </div>
          </div>
        </div>

        {/* Coming soon */}
        <div style={{
          background:'rgba(255,255,255,0.015)',border:'1px dashed rgba(255,255,255,0.08)',
          borderRadius:'18px',padding:'28px',
          display:'flex',alignItems:'center',gap:'20px',opacity:0.6,
        }}>
          <span style={{fontSize:'28px'}}>🔒</span>
          <div>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'16px',
              color:'rgba(255,255,255,0.5)',marginBottom:'4px'}}>
              More Programmes Coming in 2026
            </div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.3)'}}>
              Full Stack Web Development · DevOps & CI/CD · Data Engineering · Cybersecurity
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
