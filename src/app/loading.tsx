export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(59,91,219,0.2)',
          borderTopColor: 'var(--cyan)',
          animation: 'spin 0.8s linear infinite',
        }}/>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
