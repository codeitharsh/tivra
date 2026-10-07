'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

export default function ExploreSearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)

  function go(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    else params.delete('q')
    router.push(`/explore${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <form onSubmit={e => { e.preventDefault(); go(value) }} style={{ position: 'relative' }}>
      <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted2)' }}/>
      <input
        className="form-input"
        placeholder="Search courses and career paths…"
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ paddingLeft: '38px', paddingRight: value ? '38px' : undefined, fontSize: '14px', width: '100%' }}
      />
      {value && (
        <button
          type="button"
          onClick={() => { setValue(''); go('') }}
          aria-label="Clear search"
          style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)',
            display: 'flex', padding: '4px',
          }}
        >
          <X size={14}/>
        </button>
      )}
    </form>
  )
}
