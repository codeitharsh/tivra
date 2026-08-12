export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import type { Profile } from '@/types/database'
import {
  Users, Clock, Package, MessageCircle, Video, Award,
  BookOpen, Key, CreditCard, GraduationCap, FileText, UserPlus,
  BarChart3, Target, ClipboardList, Settings,
} from 'lucide-react'

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
        <div style={{ padding:'28px', maxWidth:'1100px', margin:'0 auto', width:'100%' }}>

          {/* Stats — admin-relevant only */}
          <div className="r-grid-3" style={{ marginBottom:'28px' }}>
            {[
              { Icon:Users,        label:'Total students',   value:totalStudents??0, color:'var(--accent-2)', href:'/admin/students'   },
              { Icon:Clock,        label:'Pending approval', value:pending??0,       color:'var(--amber)',   href:'/admin/access'     },
              { Icon:Package,      label:'Active batches',   value:activeBatches??0, color:'var(--green)',   href:'/admin/batches'    },
              { Icon:MessageCircle,label:'Open doubts',      value:openDoubts??0,    color:'var(--amber)',   href:'/doubts'           },
              { Icon:Video,        label:'Live sessions',    value:totalSessions??0, color:'var(--accent)',  href:'/admin/live'       },
              { Icon:Award,        label:'Certificates',     value:certs??0,         color:'var(--accent-2)',href:'/admin/students'   },
            ].map(s => (
              <Link key={s.label} href={s.href} style={{ textDecoration:'none' }}>
                <div className="stat-card" style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <div className="stat-label" style={{ marginBottom:0 }}>{s.label}</div>
                    <s.Icon size={14} color="var(--muted2)"/>
                  </div>
                  <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Action cards */}
          <div className="r-grid-3">
            {[
              { title:'Programmes',         desc:'Manage pricing, duration, and curriculum PDFs', href:'/admin/programs',    Icon:BookOpen },
              { title:'Grant access',       desc:'Approve students, assign batches, set roles', href:'/admin/access',      Icon:Key },
              { title:'Payment requests',   desc:'Review and approve submitted payment proofs', href:'/admin/payments',    Icon:CreditCard },
              { title:'Enrollments',        desc:'View all programme enrollments and revenue',   href:'/admin/enrollments', Icon:GraduationCap },
              { title:'Curriculum leads',   desc:'View curriculum download requests',            href:'/admin/curriculum-leads', Icon:FileText },
              { title:'Batch management',   desc:'Create batches, open/close enrolment windows',href:'/admin/batches',     Icon:Package },
              { title:'Add student to batch',desc:'Assign activated students to specific batches',href:'/admin/students',  Icon:UserPlus },
              { title:'Live sessions',      desc:'Schedule classes, track attendance',           href:'/admin/live',        Icon:Video },
              { title:'Analytics',          desc:'Platform-wide stats and performance metrics',  href:'/admin/analytics',   Icon:BarChart3 },
              { title:'Assessments',        desc:'Create phase assessments, set unlock dates',   href:'/admin/assessments', Icon:Target },
              { title:'Attendance records', desc:'Full attendance export for all sessions',       href:'/admin/attendance',  Icon:ClipboardList },
              { title:'Settings',           desc:'Programme settings, domain records',            href:'/admin/settings',    Icon:Settings },
            ].map(card => (
              <Link key={card.title} href={card.href} style={{ textDecoration:'none' }}>
                <div className="card" style={{ cursor:'pointer', height:'100%' }}>
                  <div style={{
                    width:'30px', height:'30px', borderRadius:'6px', flexShrink:0,
                    background:'var(--accent-dim)', color:'var(--accent-2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    marginBottom:'12px',
                  }}>
                    <card.Icon size={15}/>
                  </div>
                  <div style={{ fontFamily:'var(--font-serif)', fontWeight:600, fontSize:'14px',
                    marginBottom:'5px', color:'var(--text)' }}>{card.title}</div>
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
