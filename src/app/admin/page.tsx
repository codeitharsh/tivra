import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import type { Profile } from '@/types/database'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pd } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = pd as Profile | null
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const [
    { count: totalStudents },
    { count: pending },
    { count: activeBatches },
    { count: openDoubts },
    { count: totalSessions },
    { count: certs },
  ] = await Promise.all([
    admin.from('profiles').select('*',{count:'exact',head:true}).eq('role','student'),
    admin.from('profiles').select('*',{count:'exact',head:true}).eq('access_status','pending_payment'),
    admin.from('batches').select('*',{count:'exact',head:true}).eq('status','active'),
    admin.from('doubts').select('*',{count:'exact',head:true}).eq('is_resolved',false),
    admin.from('live_sessions').select('*',{count:'exact',head:true}),
    admin.from('certificates').select('*',{count:'exact',head:true}).eq('is_revoked',false),
  ])

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar profile={profile}/>
      <main className='sidebar-layout-main' style={{ flex:1, overflow:'auto' }}>
        <Topbar title="Admin Overview" subtitle="Tivra platform control centre"/>
        <div style={{ padding:'28px', maxWidth:'1080px', margin:'0 auto', width:'100%' }}>

          {/* Stats — admin-relevant only */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'28px' }}>
            {[
              { icon:'👥', label:'Total Students',   value:totalStudents??0, color:'var(--cyan)',   href:'/admin/students'   },
              { icon:'⏳', label:'Pending Approval', value:pending??0,       color:'var(--amber)',  href:'/admin/access'     },
              { icon:'📦', label:'Active Batches',   value:activeBatches??0, color:'var(--green)',  href:'/admin/batches'    },
              { icon:'💬', label:'Open Doubts',      value:openDoubts??0,    color:'#f59e0b',       href:'/doubts'           },
              { icon:'🎥', label:'Live Sessions',    value:totalSessions??0, color:'#a78bfa',       href:'/admin/live'       },
              { icon:'🏆', label:'Certificates',     value:certs??0,         color:'var(--teal)',   href:'/admin/students'   },
            ].map(s => (
              <Link key={s.label} href={s.href} style={{ textDecoration:'none' }}>
                <div className="card card-accent-top" style={{ cursor:'pointer', padding:'16px 20px' }}>
                  <div style={{ fontSize:'22px', marginBottom:'8px' }}>{s.icon}</div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'28px',
                    color:s.color, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{s.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Action cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
            {[
              { title:'Grant Access',       desc:'Approve students, assign batches, set roles', href:'/admin/access',      icon:'🔑' },
              { title:'Payment Requests',   desc:'Review and approve submitted payment proofs', href:'/admin/payments',    icon:'💰' },
              { title:'Batch Management',   desc:'Create batches, open/close enrolment windows',href:'/admin/batches',     icon:'📦' },
              { title:'Add Student to Batch',desc:'Assign activated students to specific batches',href:'/admin/students',  icon:'👤' },
              { title:'Live Sessions',      desc:'Schedule classes, track attendance',           href:'/admin/live',        icon:'🎥' },
              { title:'Analytics',          desc:'Platform-wide stats and performance metrics',  href:'/admin/analytics',   icon:'📊' },
              { title:'Assessments',        desc:'Create phase assessments, set unlock dates',   href:'/admin/assessments', icon:'🎯' },
              { title:'Attendance Records', desc:'Full attendance export for all sessions',       href:'/admin/attendance',  icon:'📋' },
              { title:'Settings',           desc:'Programme settings, domain records',            href:'/admin/settings',    icon:'⚙️' },
            ].map(card => (
              <Link key={card.title} href={card.href} style={{ textDecoration:'none' }}>
                <div className="card" style={{ cursor:'pointer', padding:'18px 20px', transition:'border-color 0.15s' }}>
                  <div style={{ fontSize:'22px', marginBottom:'10px' }}>{card.icon}</div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'14px',
                    marginBottom:'5px', color:'#fff' }}>{card.title}</div>
                  <div style={{ fontSize:'12px', color:'var(--muted)', lineHeight:1.5 }}>{card.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
