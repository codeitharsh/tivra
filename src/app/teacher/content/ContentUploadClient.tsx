'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Module {
  id: string; title: string; module_number: number; notes_url: string | null
}
interface Phase {
  id: string; title: string; phase_number: number; modules: Module[]
}

export default function ContentUploadClient({ phases, userId }: { phases: Phase[]; userId: string }) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [selectedPhase,  setSelectedPhase]  = useState(phases[0]?.id ?? '')
  const [selectedModule, setSelectedModule] = useState('')
  const [file,           setFile]           = useState<File | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [toast,          setToast]          = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const currentPhase  = phases.find(p => p.id === selectedPhase)
  const currentModule = currentPhase?.modules.find(m => m.id === selectedModule)

  async function handleUpload() {
    if (!selectedModule) { showToast('Select a module first', 'error'); return }
    if (!file)           { showToast('Choose a PDF file',    'error'); return }
    if (!file.name.toLowerCase().endsWith('.pdf')) { showToast('Only PDF files allowed', 'error'); return }
    if (file.size > 50 * 1024 * 1024)             { showToast('File too large — max 50 MB', 'error'); return }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file',      file)
      form.append('module_id', selectedModule)
      form.append('phase_id',  selectedPhase)

      const res = await fetch('/api/upload-notes', { method: 'POST', body: form })
      const json = await res.json() as { error?: string }

      if (!res.ok) throw new Error(json.error ?? 'Upload failed')

      showToast(`✓ Notes uploaded for "${currentModule?.title ?? ''}"`, 'success')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Upload form ── */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px', marginBottom: '18px' }}>
            Upload Notes PDF
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Phase */}
            <div>
              <label className="form-label">Phase</label>
              <select className="form-select" value={selectedPhase}
                onChange={e => { setSelectedPhase(e.target.value); setSelectedModule('') }}>
                {phases.map(p => (
                  <option key={p.id} value={p.id}>
                    Phase {p.phase_number}: {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Module */}
            <div>
              <label className="form-label">Module</label>
              <select className="form-select" value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}>
                <option value="">Select module…</option>
                {(currentPhase?.modules ?? []).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.module_number}. {m.title}{m.notes_url ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Drop zone */}
            <div>
              <label className="form-label">PDF File (max 50 MB)</label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f?.type === 'application/pdf') setFile(f)
                  else showToast('Only PDF files allowed', 'error')
                }}
                style={{
                  border: `2px dashed ${file ? 'rgba(0,200,248,0.4)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: file ? 'rgba(0,200,248,0.05)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <Upload size={24} style={{ color: file ? 'var(--cyan)' : 'var(--muted)', marginBottom: '8px' }}/>
                <div style={{ fontSize: '13px', color: file ? '#fff' : 'var(--muted)' }}>
                  {file ? file.name : 'Click or drag & drop PDF here'}
                </div>
                {file && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] ?? null)}/>
            </div>

            {/* Current status for selected module */}
            {currentModule && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '12px',
                background: currentModule.notes_url ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${currentModule.notes_url ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                color: currentModule.notes_url ? 'var(--green)' : 'var(--amber)',
              }}>
                {currentModule.notes_url
                  ? '✓ Notes already uploaded — uploading will replace the current file'
                  : '⚠ No notes uploaded yet for this module'}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploading || !selectedModule || !file}
              style={{ justifyContent: 'center', fontSize: '13px', padding: '11px' }}
            >
              {uploading
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/> Uploading…</>
                : <><Upload size={14}/> Upload Notes</>
              }
            </button>
          </div>
        </div>

        {/* ── Status grid ── */}
        <div>
          {phases.map(phase => (
            <div key={phase.id} style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>
                Phase {phase.phase_number}: {phase.title}
                <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '10px', fontWeight: 400 }}>
                  {phase.modules.filter(m => m.notes_url).length}/{phase.modules.length} uploaded
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '8px' }}>
                {phase.modules.map(m => (
                  <div key={m.id}
                    onClick={() => { setSelectedPhase(phase.id); setSelectedModule(m.id) }}
                    style={{
                      padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      background: m.notes_url ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${m.notes_url ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                      outline: selectedModule === m.id ? '2px solid var(--cyan)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s',
                    }}
                  >
                    {m.notes_url
                      ? <CheckCircle2 size={14} style={{ color: 'var(--green)', flexShrink: 0 }}/>
                      : <AlertCircle  size={14} style={{ color: 'var(--muted)',  flexShrink: 0 }}/>
                    }
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>
                        {m.module_number}. {m.title.length > 22 ? m.title.slice(0,22)+'…' : m.title}
                      </div>
                      <div style={{ fontSize: '10px', color: m.notes_url ? 'var(--green)' : 'var(--muted)' }}>
                        {m.notes_url ? 'Uploaded ✓' : 'Not uploaded'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
