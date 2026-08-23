'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, Plus, Trash2, ChevronUp, ChevronDown, ChevronLeft, Save,
  Upload, X,
} from 'lucide-react'
import type { CourseBlock, CourseBlockType } from '@/types/course'
import { BLOCK_TYPE_LABELS, newBlock } from '@/types/course'
import LessonBlockRenderer from '@/components/course/LessonBlockRenderer'

const BLOCK_TYPES: CourseBlockType[] = ['heading', 'paragraph', 'image', 'code', 'table', 'callout', 'list', 'divider']

export default function LessonBlockEditorClient({
  courseId, lessonId, initialContent,
}: { courseId: string; lessonId: string; initialContent: CourseBlock[] }) {
  const [blocks, setBlocks] = useState<CourseBlock[]>(initialContent)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function updateBlock(id: string, patch: Partial<CourseBlock>) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } as CourseBlock : b))
    setDirty(true)
  }

  function addBlock(type: CourseBlockType) {
    setBlocks(prev => [...prev, newBlock(type)])
    setDirty(true)
  }

  function deleteBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id))
    setDirty(true)
  }

  function moveBlock(id: string, direction: 'up' | 'down') {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_lesson_content', lessonId, content: blocks }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')
      showToast('✓ Lesson content saved', 'success')
      setDirty(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(blockId: string, file: File) {
    setUploadingFor(blockId)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('course_id', courseId)
      const res = await fetch('/api/upload-course-asset', { method: 'POST', body: form })
      const data = await res.json() as { success?: boolean; path?: string; error?: string }
      if (!res.ok || !data.success || !data.path) throw new Error(data.error ?? 'Upload failed')
      updateBlock(blockId, { path: data.path } as Partial<CourseBlock>)
      showToast('✓ Image uploaded', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploadingFor(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href={`/admin/courses/${courseId}`} style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ChevronLeft size={12}/> Back to course
        </Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty} style={{ fontSize: '13px' }}>
          {saving ? <Loader2 size={14} className="spin"/> : <><Save size={13}/> {dirty ? 'Save changes' : 'Saved'}</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '20px' }} className="lesson-editor-grid">
        {/* ── Editor column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {blocks.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: '13px' }}>
              No content blocks yet. Add one below.
            </div>
          )}

          {blocks.map((block, i) => (
            <div key={block.id} className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {BLOCK_TYPE_LABELS[block.type]}
                </span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <button className="btn btn-ghost" style={{ padding: '3px 5px' }} disabled={i === 0} onClick={() => moveBlock(block.id, 'up')}><ChevronUp size={11}/></button>
                  <button className="btn btn-ghost" style={{ padding: '3px 5px' }} disabled={i === blocks.length - 1} onClick={() => moveBlock(block.id, 'down')}><ChevronDown size={11}/></button>
                  <button className="btn btn-danger" style={{ padding: '3px 7px' }} onClick={() => deleteBlock(block.id)}><Trash2 size={11}/></button>
                </div>
              </div>

              {block.type === 'heading' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select className="form-input" style={{ width: '90px', fontSize: '12px' }}
                    value={block.level} onChange={e => updateBlock(block.id, { level: Number(e.target.value) as 2 | 3 })}>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                  <input className="form-input" placeholder="Heading text" style={{ flex: 1, fontSize: '13px' }}
                    value={block.text} onChange={e => updateBlock(block.id, { text: e.target.value })}/>
                </div>
              )}

              {block.type === 'paragraph' && (
                <div>
                  <textarea className="form-input" rows={4} placeholder="Paragraph text — supports **bold**, *italic*, `code`, [text](url)"
                    style={{ fontSize: '13px', resize: 'vertical', width: '100%' }}
                    value={block.text} onChange={e => updateBlock(block.id, { text: e.target.value })}/>
                </div>
              )}

              {block.type === 'image' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    ref={el => { fileInputs.current[block.id] = el }}
                    type="file" accept="image/png,image/jpeg,image/gif,image/webp" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(block.id, f); e.target.value = '' }}
                  />
                  <button className="btn btn-ghost" style={{ fontSize: '12px', alignSelf: 'flex-start' }}
                    disabled={uploadingFor === block.id} onClick={() => fileInputs.current[block.id]?.click()}>
                    {uploadingFor === block.id ? <Loader2 size={12} className="spin"/> : <><Upload size={12}/> {block.path ? 'Replace image' : 'Upload image'}</>}
                  </button>
                  {block.path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-assets/${block.path}`}
                      alt="" style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}/>
                  )}
                  <input className="form-input" placeholder="Alt text (for accessibility)" style={{ fontSize: '12px' }}
                    value={block.alt} onChange={e => updateBlock(block.id, { alt: e.target.value })}/>
                  <input className="form-input" placeholder="Caption (optional)" style={{ fontSize: '12px' }}
                    value={block.caption} onChange={e => updateBlock(block.id, { caption: e.target.value })}/>
                </div>
              )}

              {block.type === 'code' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input className="form-input" placeholder="Language (e.g. python, sql, javascript)" style={{ fontSize: '12px' }}
                    value={block.language} onChange={e => updateBlock(block.id, { language: e.target.value })}/>
                  <textarea className="form-input" rows={6} placeholder="Code…" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
                    value={block.code} onChange={e => updateBlock(block.id, { code: e.target.value })}/>
                </div>
              )}

              {block.type === 'callout' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select className="form-input" style={{ fontSize: '12px' }}
                    value={block.variant} onChange={e => updateBlock(block.id, { variant: e.target.value as 'info' | 'warning' | 'tip' })}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="tip">Tip</option>
                  </select>
                  <textarea className="form-input" rows={2} placeholder="Callout text" style={{ fontSize: '13px', resize: 'vertical' }}
                    value={block.text} onChange={e => updateBlock(block.id, { text: e.target.value })}/>
                </div>
              )}

              {block.type === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={block.ordered} onChange={e => updateBlock(block.id, { ordered: e.target.checked })}/>
                    Numbered list
                  </label>
                  {block.items.map((item, ii) => (
                    <div key={ii} style={{ display: 'flex', gap: '6px' }}>
                      <input className="form-input" style={{ flex: 1, fontSize: '12px' }} value={item}
                        onChange={e => {
                          const items = [...block.items]; items[ii] = e.target.value
                          updateBlock(block.id, { items })
                        }}/>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }}
                        onClick={() => updateBlock(block.id, { items: block.items.filter((_, x) => x !== ii) })}>
                        <X size={11}/>
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', alignSelf: 'flex-start' }}
                    onClick={() => updateBlock(block.id, { items: [...block.items, ''] })}>
                    <Plus size={11}/> Add item
                  </button>
                </div>
              )}

              {block.type === 'table' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {block.headers.map((h, hi) => (
                      <input key={hi} className="form-input" style={{ flex: 1, fontSize: '12px' }} value={h}
                        onChange={e => {
                          const headers = [...block.headers]; headers[hi] = e.target.value
                          updateBlock(block.id, { headers })
                        }}/>
                    ))}
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => updateBlock(block.id, {
                        headers: [...block.headers, `Column ${block.headers.length + 1}`],
                        rows: block.rows.map(r => [...r, '']),
                      })}>
                      <Plus size={11}/>
                    </button>
                  </div>
                  {block.rows.map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', gap: '6px' }}>
                      {row.map((cell, ci) => (
                        <input key={ci} className="form-input" style={{ flex: 1, fontSize: '12px' }} value={cell}
                          onChange={e => {
                            const rows = block.rows.map(r => [...r])
                            rows[ri][ci] = e.target.value
                            updateBlock(block.id, { rows })
                          }}/>
                      ))}
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }}
                        onClick={() => updateBlock(block.id, { rows: block.rows.filter((_, x) => x !== ri) })}>
                        <X size={11}/>
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', alignSelf: 'flex-start' }}
                    onClick={() => updateBlock(block.id, { rows: [...block.rows, block.headers.map(() => '')] })}>
                    <Plus size={11}/> Add row
                  </button>
                </div>
              )}

              {block.type === 'divider' && (
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>A horizontal divider line.</div>
              )}
            </div>
          ))}

          <div className="card" style={{ padding: '14px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {BLOCK_TYPES.map(t => (
              <button key={t} className="btn btn-ghost" style={{ fontSize: '11px' }} onClick={() => addBlock(t)}>
                <Plus size={11}/> {BLOCK_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Live preview column — same renderer students see ── */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Live preview
          </div>
          <div className="card" style={{ padding: '24px', position: 'sticky', top: '20px' }}>
            <LessonBlockRenderer blocks={blocks}/>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200 }}>
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }
        @media (max-width: 900px) { .lesson-editor-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
