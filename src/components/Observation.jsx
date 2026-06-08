export default function Observation({ item }) {
  if (!item) return null

  return (
    <div className="obs-scroll" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: `calc(100% - var(--above-h))`,
      overflowY: 'auto',
      background: 'var(--bone)',
      WebkitOverflowScrolling: 'touch',
    }}>

      {/* Image — full viewport width, capped at 800px */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        aspectRatio: '4/3',
        overflow: 'hidden',
      }}>
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: item.color }} />
        )}
      </div>

      <article style={{
        width: '100%',
        maxWidth: 'clamp(300px, 60vw, 680px)',
        margin: '0 auto',
        padding: 'clamp(28px, 5vw, 56px) clamp(16px, 4vw, 0px) clamp(40px, 8vw, 96px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(24px, 4vw, 40px)',
        boxSizing: 'border-box',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h1 style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: 'clamp(24px, 4vw, 42px)',
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}>
            {item.title}
          </h1>
          <span style={{
            fontSize: 'clamp(10px, 1.1vw, 12px)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink-mid)',
          }}>
            {item.year}
          </span>
        </div>

        <Divider />

        {/* Attribution */}
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 24px' }}>
          <Field label="Artist" value={item.artist + (item.collective ? ` / ${item.collective}` : '')} />
          <Field label="Type" value={item.type} />
          <Field label="Medium" value={item.medium} />
        </dl>

        <Divider />

        {/* Description */}
        <p style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)',
          lineHeight: 1.65,
          color: 'var(--ink)',
          fontWeight: 400,
        }}>
          {item.description}
        </p>

        {/* Idea */}
        <blockquote style={{
          borderLeft: '1px solid var(--ink-faint)',
          paddingLeft: 'clamp(14px, 2vw, 24px)',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <span style={{
            fontSize: 'clamp(9px, 1vw, 11px)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}>
            Idea
          </span>
          <span style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: 'clamp(14px, 1.6vw, 17px)',
            fontStyle: 'italic',
            lineHeight: 1.6,
            color: 'var(--ink-mid)',
          }}>
            {item.idea}
          </span>
        </blockquote>

        <div style={{ height: 'clamp(40px, 8vw, 80px)' }} />
      </article>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <>
      <dt style={{
        fontSize: 'clamp(9px, 1vw, 11px)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--ink-faint)',
        paddingTop: '2px',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </dt>
      <dd style={{
        fontSize: 'clamp(11px, 1.3vw, 13px)',
        color: 'var(--ink)',
        letterSpacing: '0.01em',
      }}>
        {value}
      </dd>
    </>
  )
}

function Divider() {
  return (
    <div style={{
      width: '100%',
      height: '1px',
      background: 'rgba(28,28,28,0.1)',
    }} />
  )
}
