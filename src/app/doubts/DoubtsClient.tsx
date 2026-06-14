'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, ThumbsUp, CheckCircle2, Plus, X, Loader2, Filter } from 'lucide-react'

interface Props {
  doubts:   Record<string, unknown>[]
  userId:   string
  userRole: string
  modules:  { id: string; title: string }[]
}

async function apiDoubts(action: string, body: Record<string, unknown>) {
  const res = await fetch('/api/doubts', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, ...body }),
  })
  return res.json() as Promise<{ error?: string; success?: boolean }>
}

export default function DoubtsClient({ doubts, userId, userRole, modules }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [showNew,    setShowNew]    = useState(false)
  const [question,   setQuestion]   = useState('')
  const [moduleId,   setModuleId]   = useState('')
  const [answerText, setAnswerText] = useState<Record<string, string>>({})
  const [answering,  setAnswering]  = useState<string | null>(null)
  const [filter,     setFilter]     = useState<'all' | 'open' | 'resolved'>('all')
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [saving,     setSaving]     = useState<string | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const isStaff = ['admin', 'teacher'].includes(userRole)

  async function postDoubt() {
    if (!question.trim()) { showToast('Write your question first', 'error'); return }
    setSaving('new')
    start(async () => {
      const res = await apiDoubts('post_doubt', { questionText: question.trim(), moduleId: moduleId || null })
      if (res.error) showToast(res.error, 'error')
      else {
        showToast('✓ Doubt posted', 'success')
        setQuestion(''); setModuleId(''); setShowNew(false)
        router.refresh()
      }
      setSaving(null)
    })
  }

  async function postAnswer(doubtId: string) {
    const text = answerText[doubtId]?.trim()
    if (!text) { showToast('Write an answer first', 'error'); return }
    setSaving(doubtId)
    start(async () => {
      const res = await apiDoubts('post_answer', { doubtId, answerText: text })
      if (res.error) showToast(res.error, 'error')
      else {
        showToast('✓ Answer posted', 'success')
        setAnswerText(p => ({ ...p, [doubtId]: '' }))
        setAnswering(null)
        router.refresh()
      }
      setSaving(null)
    })
  }

  async function upvote(doubtId: string) {
    start(async () => {
      await apiDoubts('upvote', { doubtId })
      router.refresh()
    })
  }

  const filtered = doubts.filter(d => {
    if (filter === 'open')     return !d.is_resolved
    if (filter === 'resolved') return  d.is_resolved
    return true
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'open', 'resolved'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: '100px', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'DM Sans,sans-serif',
              background: filter === f ? 'linear-gradient(135deg,#00c8f8,#7030d0)' : 'rgba(255,255,255,0.06)',
              color: filter === f ? '#fff' : 'var(--muted)',
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'open' && <span style={{ marginLeft: '5px', color: 'var(--amber)' }}>
                ({doubts.filter(d => !d.is_resolved).length})
              </span>}
            </button>
          ))}
        </div>

        {/* Only students can post doubts */}
        {!isStaff && (
          <button className="btn btn-primary" onClick={() => setShowNew(v => !v)} style={{ fontSize: '13px' }}>
            {showNew ? <><X size={14}/> Cancel</> : <><Plus size={14}/> Ask a Question</>}
          </button>
        )}
      </div>

      {/* New doubt form */}
      {showNew && !isStaff && (
        <div className="card" style={{ marginBottom: '20px', padding: '20px', border: '1px solid rgba(0,200,248,0.2)' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>
            Ask a Question
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {modules.length > 0 && (
              <div>
                <label className="form-label">Related Module (optional)</label>
                <select className="form-select" value={moduleId} onChange={e => setModuleId(e.target.value)}>
                  <option value="">General question</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="form-label">Your Question *</label>
              <textarea className="form-input" rows={3}
                placeholder="Be specific — what exactly are you stuck on?"
                value={question} onChange={e => setQuestion(e.target.value)}
                style={{ resize: 'vertical' }}/>
            </div>
            <button className="btn btn-primary" onClick={postDoubt}
              disabled={saving === 'new' && isPending} style={{ fontSize: '13px', alignSelf: 'flex-start' }}>
              {saving === 'new' && isPending
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> Posting…</>
                : <><MessageCircle size={13}/> Post Question</>}
            </button>
          </div>
        </div>
      )}

      {/* Doubts list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
          <div style={{ fontSize: '14px' }}>
            {filter === 'open' ? 'No open doubts — all answered!' : 'No doubts yet.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(d => {
            const poster  = d.profiles as Record<string, unknown> | null
            const mod     = d.modules  as Record<string, unknown> | null
            const answers = (d.doubt_answers as Record<string, unknown>[] | null) ?? []
            const did     = d.id as string

            return (
              <div key={did} className="card" style={{
                padding: '18px 20px',
                borderLeft: `2px solid ${d.is_resolved ? 'var(--green)' : 'var(--amber)'}`,
              }}>
                {/* Doubt header */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                  {/* Upvote */}
                  <button onClick={() => upvote(did)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '6px 10px', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0,
                  }}>
                    <ThumbsUp size={13}/>
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>{String(d.upvotes ?? 0)}</span>
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.5, marginBottom: '6px' }}>
                      {String(d.question_text ?? '')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span>{String(poster?.full_name ?? 'Student')}</span>
                      {mod && <span>· {String(mod.title ?? '')}</span>}
                      <span>· {new Date(d.created_at as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      {d.is_resolved
                        ? <span style={{ color: 'var(--green)' }}>✓ Resolved</span>
                        : <span style={{ color: 'var(--amber)' }}>● Open</span>}
                    </div>
                  </div>
                </div>

                {/* Answers */}
                {answers.length > 0 && (
                  <div style={{ marginLeft: '44px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {answers.map(a => {
                      const responder = a.profiles as Record<string, unknown> | null
                      return (
                        <div key={a.id as string} style={{
                          padding: '12px 14px', borderRadius: '8px',
                          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)',
                        }}>
                          <div style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: '6px' }}>
                            {String(a.answer_text ?? '')}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--green)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <CheckCircle2 size={11}/>
                            <span>{String(responder?.full_name ?? 'Teacher')} · {new Date(a.created_at as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Answer form — teachers and admins only */}
                {isStaff && !d.is_resolved && (
                  <div style={{ marginLeft: '44px' }}>
                    {answering === did ? (
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <textarea className="form-input" rows={2}
                          placeholder="Write your answer…"
                          value={answerText[did] ?? ''}
                          onChange={e => setAnswerText(p => ({ ...p, [did]: e.target.value }))}
                          style={{ resize: 'vertical' }}/>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" onClick={() => postAnswer(did)}
                            disabled={saving === did && isPending} style={{ fontSize: '12px', padding: '7px 14px' }}>
                            {saving === did && isPending
                              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/> Posting…</>
                              : 'Post Answer'}
                          </button>
                          <button className="btn btn-ghost" onClick={() => setAnswering(null)}
                            style={{ fontSize: '12px' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => setAnswering(did)}
                        style={{ fontSize: '12px', padding: '6px 14px' }}>
                        <MessageCircle size={12}/> Answer this doubt
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
