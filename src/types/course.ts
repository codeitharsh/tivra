// Self-paced course content blocks — an ordered JSON array stored on
// course_lessons.content. `type` is the discriminant; adding a new block
// type later (quiz, video, interactive) is additive: a new variant here,
// a new case in LessonBlockRenderer, a new sub-form in the admin editor.
// No migration needed since the column is jsonb.

export type CourseBlock =
  | { id: string; type: 'heading';  text: string; level: 2 | 3 }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'image';    path: string; alt: string; caption: string }
  | { id: string; type: 'code';     language: string; code: string }
  | { id: string; type: 'table';    headers: string[]; rows: string[][] }
  | { id: string; type: 'callout';  variant: 'info' | 'warning' | 'tip'; text: string }
  | { id: string; type: 'list';     ordered: boolean; items: string[] }
  | { id: string; type: 'divider' }

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
  }
}
