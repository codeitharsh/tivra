'use client'

import { useState } from 'react'
import CurriculumLeadModal from './CurriculumLeadModal'

interface Props {
  programSlug: string
  programName: string
  style?: React.CSSProperties
  className?: string
  inline?: boolean
}

export default function ViewCurriculumButton({ programSlug, programName, style, className, inline }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? (inline ? undefined : 'btn btn-ghost')}
        style={inline ? {
          background: 'none', border: 'none', padding: 0,
          color: 'var(--accent)', fontFamily: 'var(--font-sans), sans-serif',
          fontWeight: 600, fontSize: '14px', cursor: 'pointer', textDecoration: 'underline',
          ...style,
        } : style}
      >
        {inline ? 'View Curriculum' : 'View Curriculum'}
      </button>
      <CurriculumLeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        programSlug={programSlug}
        programName={programName}
      />
    </>
  )
}
