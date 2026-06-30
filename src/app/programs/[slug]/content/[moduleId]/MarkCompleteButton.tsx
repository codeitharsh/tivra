'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function MarkCompleteButton({
  moduleId,
  studentId,
  currentStatus,
}: {
  moduleId: string
  studentId: string
  currentStatus: string
}) {
  const [status, setStatus]       = useState(currentStatus)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast]         = useState<string | null>(null)
  const router                    = useRouter()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function toggle() {
    const supabase  = createClient()
    const newStatus = status === 'completed' ? 'in_progress' : 'completed'

    startTransition(async () => {
      const { createClient: rawSB } = await import('@supabase/supabase-js')
      const sb2 = rawSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) sb2.auth.setSession(session)
      const { error } = await sb2.from('module_progress').upsert({
          student_id:   studentId,
          module_id:    moduleId,
          status:       newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        }, { onConflict: 'student_id,module_id' })

      if (error) {
        showToast('Something went wrong. Try again.')
      } else {
        setStatus(newStatus)
        showToast(newStatus === 'completed' ? '✓ Module marked as complete!' : 'Marked as in progress')
        router.refresh()
      }
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        disabled={isPending}
        className="btn"
        style={{
          background: status === 'completed'
            ? 'rgba(34,197,94,0.12)'
            : 'var(--grad-brand)',
          color: status === 'completed' ? 'var(--green)' : '#fff',
          border: status === 'completed' ? '1px solid rgba(34,197,94,0.25)' : 'none',
          fontSize: '13px',
          padding: '10px 20px',
          flexShrink: 0,
        }}
      >
        {isPending ? (
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/>
        ) : status === 'completed' ? (
          <><RotateCcw size={14}/> Unmark</>
        ) : (
          <><CheckCircle2 size={14}/> Mark Complete</>
        )}
      </button>

      {toast && (
        <div
          className={`toast ${toast.includes('✓') ? 'toast-success' : 'toast-error'}`}
          style={{
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 200,
          }}
        >
          {toast}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
