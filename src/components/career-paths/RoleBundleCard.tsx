import Link from 'next/link'
import { Briefcase, ArrowRight } from 'lucide-react'

export interface RoleBundleCardData {
  id: string; slug: string; title: string; description: string | null
  skills: string[]; price_inr: number | null; original_price_inr: number | null
}

// Visual sibling of CourseCard — same image-top/badge/footer structure,
// but role bundles have no cover photo, so the "media" area is a gradient
// band carrying the role's initial instead. Keeps the Explore grid
// reading as one consistent card language rather than two different ones.
export default function RoleBundleCard({ path }: { path: RoleBundleCardData }) {
  return (
    <Link href={`/explore/roles/${path.slug}`} className="course-card-link" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div className="card course-card" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--accent), #2a2a2a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Briefcase size={40} color="rgba(255,255,255,0.85)" className="course-card-img"/>
          <span className="pill" style={{
            position: 'absolute', top: '12px', left: '12px',
            background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
          }}>Career Path</span>
          {path.price_inr ? (
            <span style={{
              position: 'absolute', top: '12px', right: '12px',
              display: 'flex', alignItems: 'baseline', gap: '5px',
              padding: '4px 10px', borderRadius: 'var(--radius-pill)',
              background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
            }}>
              {path.original_price_inr && path.original_price_inr > path.price_inr && (
                <span style={{ fontSize: '11px', color: 'var(--muted2)', textDecoration: 'line-through' }}>
                  ₹{path.original_price_inr.toLocaleString('en-IN')}
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                ₹{path.price_inr.toLocaleString('en-IN')}
              </span>
            </span>
          ) : (
            <span className="pill" style={{
              position: 'absolute', top: '12px', right: '12px',
              background: 'rgba(255,255,255,0.94)', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
            }}>Free</span>
          )}
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '16px', color: 'var(--text)',
            marginBottom: '6px', lineHeight: 1.3,
          }}>
            {path.title}
          </div>
          {path.description && (
            <p style={{
              fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55, marginBottom: '12px', flex: 1,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {path.description}
            </p>
          )}
          {path.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {path.skills.slice(0, 4).map(s => (
                <span key={s} style={{
                  fontSize: '11px', padding: '3px 9px', borderRadius: '20px',
                  background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--muted)',
                }}>{s}</span>
              ))}
            </div>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-2)', marginTop: 'auto' }}>
            View career path <ArrowRight size={13}/>
          </span>
        </div>
      </div>
    </Link>
  )
}
