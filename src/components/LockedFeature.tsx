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
        width: '64px', height: '64px', borderRadius: '50%',
        background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
      }}>
        <Lock size={28} style={{ color: 'var(--cyan)' }}/>
      </div>
      <h2 style={{
        fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '22px',
        color: '#fff', marginBottom: '10px',
      }}>
        {feature} is locked
      </h2>
      <p style={{
        fontSize: '14px', color: 'rgba(255,255,255,0.45)',
        maxWidth: '360px', lineHeight: 1.7, marginBottom: '28px',
      }}>
        {description ?? (ENROLLMENT_OPEN
          ? 'Enrol in a programme to unlock this feature. You\'ll get full access immediately after payment.'
          : 'Enrollments will start soon. Check back to unlock this feature.')}
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {ENROLLMENT_OPEN ? (
          <Link href="/payment" style={{
            padding: '12px 28px', borderRadius: '100px',
            background: 'linear-gradient(135deg,#00d4ff,#3b5bdb,#7c3aed)',
            color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 700,
            fontSize: '14px', textDecoration: 'none',
            boxShadow: '0 6px 24px rgba(59,91,219,0.3)',
          }}>
            Enrol Now →
          </Link>
        ) : (
          <span style={{
            padding: '12px 28px', borderRadius: '100px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.3)', fontFamily: 'Syne,sans-serif', fontWeight: 700,
            fontSize: '14px', cursor: 'not-allowed',
          }}>
            Enrollments Will Start Soon
          </span>
        )}
        <Link href="/pending" style={{
          padding: '12px 28px', borderRadius: '100px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)', fontFamily: 'Syne,sans-serif', fontWeight: 600,
          fontSize: '14px', textDecoration: 'none',
        }}>
          Explore Programmes
        </Link>
      </div>
    </div>
  )
}
