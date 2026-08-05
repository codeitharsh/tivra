'use client'

export default function SignOutButton() {
  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button onClick={handleSignOut} type="button" className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 14px' }}>
      Sign out
    </button>
  )
}
