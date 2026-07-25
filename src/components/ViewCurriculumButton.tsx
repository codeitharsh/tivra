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
        className={className}
        style={inline ? {
          background: 'none', border: 'none', padding: 0,
          color: '#00d4ff', fontFamily: 'DM Sans,sans-serif',
          fontWeight: 600, fontSize: '14px', cursor: 'pointer', textDecoration: 'underline',
          ...style,
        } : {
          padding: '14px 32px', borderRadius: '100px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.7)', fontFamily: 'DM Sans,sans-serif',
          fontWeight: 500, fontSize: '14px', cursor: 'pointer',
          ...style,
        }}
      >
        {inline ? 'View Curriculum' : 'View Curriculum ↓'}
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
