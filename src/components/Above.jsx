export default function Above({ mode, items, activeIndex, onBack }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      height: 'var(--above-h)',
      background: 'var(--bone)',
      borderTop: '1px solid rgba(28,28,28,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 clamp(16px, 5vw, 56px)',
      zIndex: 100,
    }}>
      {mode === 'observation' ? (
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--ink)',
            fontSize: 'clamp(9px, 1vw, 11px)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
          }}
        >
          <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
            <path d="M0 4H15M4 1L0 4L4 7" stroke="currentColor" strokeWidth="0.8"/>
          </svg>
          Back to journey
        </button>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(4px, 1vw, 10px)',
          width: '100%',
          maxWidth: '720px',
        }}>
          {items.map((item, i) => {
            const isActive = i === activeIndex
            return (
              <div
                key={item.id}
                title={item.title}
                style={{
                  flex: 1,
                  height: isActive ? '2px' : '1px',
                  background: isActive ? 'var(--ink)' : 'var(--ink-faint)',
                  transition: 'height 0.35s ease, background 0.35s ease',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
