import Link from 'next/link'
import { Lock } from 'lucide-react'
import { ENROLLMENT_OPEN } from '@/lib/enrollment'

interface Props {
  feature: string
  description?: string
}

export default function LockedFeature({ feature, description }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: '60px', height: '60px', borderRadius: 'var(--radius)',
        background: 'var(--card2)', border: '1px solid var(--border2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '22px',
      }}>
        <Lock size={24} style={{ color: 'var(--muted)' }}/>
      </div>
      <h2 style={{
        fontFamily: 'var(--font-serif), serif', fontWeight: 600, fontSize: '24px',
        color: 'var(--text)', marginBottom: '10px',
      }}>
        {feature} is locked
      </h2>
      <p style={{
        fontSize: '14px', color: 'var(--muted)',
        maxWidth: '360px', lineHeight: 1.7, marginBottom: '28px',
      }}>
        {description ?? (ENROLLMENT_OPEN
          ? 'Enrol in a programme to unlock this feature. You\'ll get full access immediately after payment.'
          : 'Enrollments will start soon. Check back to unlock this feature.')}
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {ENROLLMENT_OPEN ? (
          <Link href="/payment" className="btn btn-primary">Enrol Now</Link>
        ) : (
          <span className="btn" style={{ background: 'var(--card2)', color: 'var(--muted2)', cursor: 'not-allowed' }}>
            Enrollments Will Start Soon
          </span>
        )}
        <Link href="/pending" className="btn btn-ghost">Explore Programmes</Link>
      </div>
    </div>
  )
}
