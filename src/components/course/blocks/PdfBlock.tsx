'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, Loader2 } from 'lucide-react'

// PDF content is private (shared `notes` bucket, same as programme module
// notes), so unlike the image/video blocks this can't just build a public
// URL from the path — it has to ask the server for a short-lived signed
// URL, re-verified against the viewer's purchase status server-side.
export default function PdfBlock({
  lessonId, blockId, path, title,
}: { lessonId: string; blockId: string; path: string; title: string }) {
  const [url, setUrl]   = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    setUrl(null)
    setError(null)
    fetch('/api/course-pdf-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, blockId, path }),
    })
      .then(async res => {
        const json = await res.json() as { url?: string; error?: string }
        if (!res.ok || !json.url) throw new Error(json.error ?? 'Could not load this PDF')
        if (!cancelled) setUrl(json.url)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this PDF') })
    return () => { cancelled = true }
  }, [lessonId, blockId, path])

  if (!path) {
    return (
      <div style={{ margin: '20px 0', padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px',
        background: 'var(--card2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <FileText size={24} color="var(--muted2)" style={{ marginBottom: '8px' }}/>
        <div>No PDF attached to this block yet.</div>
      </div>
    )
  }

  return (
    <div className="card" style={{ margin: '20px 0', padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={15}/> {title || 'Document'}
        </div>
        {url && (
          <a href={url} download target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 14px' }}>
            <Download size={13}/> Download
          </a>
        )}
      </div>
      {error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red-text)', fontSize: '13px' }}>{error}</div>
      ) : url ? (
        <iframe src={url} style={{ width: '100%', height: '600px', border: 'none', display: 'block' }} title={title || 'Document'}/>
      ) : (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
          <Loader2 size={20} className="spin" style={{ marginBottom: '8px' }}/>
          <div style={{ fontSize: '13px' }}>Loading document…</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  )
}
