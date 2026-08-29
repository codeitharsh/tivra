import type { CourseBlock } from '@/types/course'
import { renderInlineSafe } from '@/lib/safe-richtext'
import CodeBlock from './blocks/CodeBlock'
import QuizBlock from './blocks/QuizBlock'
import ToggleBlock from './blocks/ToggleBlock'
import TabsBlock from './blocks/TabsBlock'

// This component itself stays a plain server-renderable function — most
// block types are static markup, no client JS needed. quiz/toggle/tabs/
// code are the interactive exceptions and delegate to their own 'use
// client' components; composing a client component inside a server one
// is the standard Next.js pattern, and since this same function is also
// imported directly into the admin editor's (already-client) preview
// pane, both call sites keep rendering through one shared code path.

const CALLOUT_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  info:    { bg: 'var(--accent-2-dim)', border: 'rgba(0,212,255,0.25)', color: 'var(--accent-2)' },
  warning: { bg: 'var(--yellow-dim, rgba(245,158,11,0.1))', border: 'rgba(245,158,11,0.3)', color: '#f59e0b' },
  tip:     { bg: 'var(--green-dim)', border: 'rgba(74,222,128,0.25)', color: 'var(--green)' },
}

function courseAssetUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-assets/${path}`
}

export default function LessonBlockRenderer({ blocks }: { blocks: CourseBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
        This lesson has no content yet.
      </div>
    )
  }

  return (
    <div style={{ fontSize: '15px', lineHeight: 1.75, color: 'var(--text)' }}>
      {blocks.map(block => {
        switch (block.type) {
          case 'heading': {
            const Tag = block.level === 2 ? 'h2' : 'h3'
            return (
              <Tag key={block.id} style={{
                fontFamily: 'var(--font-serif)', fontWeight: 600,
                fontSize: block.level === 2 ? '22px' : '18px',
                margin: '28px 0 12px', color: 'var(--text)',
              }}>{block.text}</Tag>
            )
          }
          case 'paragraph':
            return (
              <p key={block.id} style={{ margin: '0 0 16px' }}
                dangerouslySetInnerHTML={{ __html: renderInlineSafe(block.text) }}/>
            )
          case 'image':
            return (
              <figure key={block.id} style={{ margin: '20px 0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={courseAssetUrl(block.path)}
                  alt={block.alt}
                  style={{ maxWidth: '100%', borderRadius: 'var(--radius)', display: 'block', border: '1px solid var(--border)' }}
                />
                {block.caption && (
                  <figcaption style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', textAlign: 'center' }}>
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            )
          case 'code':
            return <CodeBlock key={block.id} language={block.language} code={block.code}/>
          case 'quiz':
            return (
              <QuizBlock key={block.id} question={block.question} options={block.options}
                correct_index={block.correct_index} explanation={block.explanation}/>
            )
          case 'toggle':
            return <ToggleBlock key={block.id} label={block.label} text={block.text}/>
          case 'tabs':
            return <TabsBlock key={block.id} tabs={block.tabs}/>
          case 'table':
            return (
              <div key={block.id} style={{ margin: '16px 0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {block.headers.map((h, i) => (
                        <th key={i} style={{
                          textAlign: 'left', padding: '10px 14px', background: 'var(--card2)',
                          border: '1px solid var(--border)', fontWeight: 600, color: 'var(--text)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '10px 14px', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'callout': {
            const s = CALLOUT_STYLES[block.variant] ?? CALLOUT_STYLES.info
            return (
              <div key={block.id} style={{
                margin: '16px 0', padding: '14px 18px', borderRadius: 'var(--radius)',
                background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: '14px',
              }} dangerouslySetInnerHTML={{ __html: renderInlineSafe(block.text) }}/>
            )
          }
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul'
            return (
              <Tag key={block.id} style={{ margin: '0 0 16px', paddingLeft: '22px' }}>
                {block.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}
                    dangerouslySetInnerHTML={{ __html: renderInlineSafe(item) }}/>
                ))}
              </Tag>
            )
          }
          case 'divider':
            return <hr key={block.id} style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }}/>
          default:
            return null
        }
      })}
    </div>
  )
}
