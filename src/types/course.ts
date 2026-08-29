// Self-paced course content blocks — an ordered JSON array stored on
// course_lessons.content. `type` is the discriminant; adding a new block
// type later is additive: a new variant here, a new case in
// LessonBlockRenderer, a new sub-form in the admin editor. No migration
// needed since the column is jsonb.
//
// quiz/toggle/tabs are the interactive block types — rendered as client
// components (see src/components/course/blocks/) since they need local
// state (selected answer, open/closed, active tab). quiz is deliberately
// ungraded and ships its correct_index straight to the client: it's a
// formative self-check embedded in admin-authored content, not a scored
// assessment, so there's no certificate/completion incentive to game and
// no need for the server-side-only-correct-answer treatment that the
// real test/assessment system uses.

export type CourseBlock =
  | { id: string; type: 'heading';  text: string; level: 2 | 3 }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'image';    path: string; alt: string; caption: string }
  | { id: string; type: 'code';     language: string; code: string }
  | { id: string; type: 'table';    headers: string[]; rows: string[][] }
  | { id: string; type: 'callout';  variant: 'info' | 'warning' | 'tip'; text: string }
  | { id: string; type: 'list';     ordered: boolean; items: string[] }
  | { id: string; type: 'divider' }
  | { id: string; type: 'quiz';     question: string; options: string[]; correct_index: number; explanation: string }
  | { id: string; type: 'toggle';   label: string; text: string }
  | { id: string; type: 'tabs';     tabs: { label: string; language: string; code: string }[] }

export type CourseBlockType = CourseBlock['type']

export const BLOCK_TYPE_LABELS: Record<CourseBlockType, string> = {
  heading:   'Heading',
  paragraph: 'Paragraph',
  image:     'Image',
  code:      'Code Block',
  table:     'Table',
  callout:   'Callout',
  list:      'List',
  divider:   'Divider',
  quiz:      'Quiz (self-check)',
  toggle:    'Toggle / Reveal',
  tabs:      'Tabbed Code',
}

export function newBlock(type: CourseBlockType): CourseBlock {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `blk_${Date.now()}_${Math.random().toString(36).slice(2)}`
  switch (type) {
    case 'heading':   return { id, type, text: '', level: 2 }
    case 'paragraph': return { id, type, text: '' }
    case 'image':     return { id, type, path: '', alt: '', caption: '' }
    case 'code':      return { id, type, language: 'text', code: '' }
    case 'table':     return { id, type, headers: ['Column 1', 'Column 2'], rows: [['', '']] }
    case 'callout':   return { id, type, variant: 'info', text: '' }
    case 'list':      return { id, type, ordered: false, items: [''] }
    case 'divider':   return { id, type }
    case 'quiz':      return { id, type, question: '', options: ['', ''], correct_index: 0, explanation: '' }
    case 'toggle':    return { id, type, label: 'Try it yourself', text: '' }
    case 'tabs':      return { id, type, tabs: [{ label: 'Tab 1', language: 'bash', code: '' }, { label: 'Tab 2', language: 'bash', code: '' }] }
  }
}
