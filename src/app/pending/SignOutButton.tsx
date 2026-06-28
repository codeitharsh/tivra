'use client'

export default function SignOutButton() {
  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button onClick={handleSignOut} type="button" style={{
      background: 'none', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '6px 14px', cursor: 'pointer',
      color: 'rgba(255,255,255,0.4)', fontSize: '12px',
    }}>
      Sign Out
    </button>
  )
}
