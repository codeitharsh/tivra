'use client'

import { useState, useEffect } from 'react'

export default function CountdownCell({ unlockAt }: { unlockAt: string }) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    function compute() {
      const diff = new Date(unlockAt).getTime() - Date.now()
      if (diff <= 0) {
        setDisplay('Opening…')
        return
      }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)

      if (d > 0)      setDisplay(`${d}d ${h}h ${m}m`)
      else if (h > 0) setDisplay(`${h}h ${m}m ${s}s`)
      else            setDisplay(`${m}m ${s}s`)
    }

    compute()
    const id = setInterval(compute, 1000)
    return () => clearInterval(id)
  }, [unlockAt])

  return (
    <span style={{
      fontFamily: 'Syne, sans-serif', fontSize: '12px',
      color: 'var(--amber)', fontWeight: 600,
    }}>
      {display}
    </span>
  )
}
