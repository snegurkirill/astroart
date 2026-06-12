import { useEffect, useRef, useState, useCallback } from 'react'

const Z_SPACING = 680
const SIDE_OFFSET = 'clamp(50px, 9vw, 130px)'

function CardMesh({ item, index, cameraZ, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const effectiveZ = -index * Z_SPACING + cameraZ

  // Three stages: Queue (full) → Exposure (full) → Outgoing (fades with scroll)
  const ez = effectiveZ / Z_SPACING
  let opacity = 0
  if (ez > 0.28) {
    opacity = 0
  } else if (ez >= 0) {
    opacity = 1 - ez / 0.28                    // Outgoing: 1→0
  } else if (ez >= -3.2) {
    opacity = 1                                 // Exposure + Queue: full
  } else if (ez >= -3.6) {
    opacity = (ez + 3.6) / 0.4                 // soft entrance
  }
  opacity = Math.min(1, Math.max(0, opacity))

  // Any visible card is selectable — isActive only drives focal styling
  const isVisible = opacity > 0.01
  const isActive = effectiveZ > -Z_SPACING * 0.55 && effectiveZ < Z_SPACING * 0.35
  const xSign = index % 2 === 0 ? 1 : -1

  return (
    <div
      style={{
        position: 'absolute',
        width: 'var(--card-w)',
        height: 'var(--card-h)',
        left: '50%',
        top: '50%',
        transform: `
          translateX(calc(-50% + ${xSign} * ${SIDE_OFFSET}))
          translateY(-50%)
          translateZ(${-index * Z_SPACING}px)
        `,
        opacity,
        display: isVisible ? 'block' : 'none',
        cursor: isVisible ? 'pointer' : 'default',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      onClick={() => onSelect(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardFace item={item} isActive={isActive} hovered={hovered} />
    </div>
  )
}

function CardFace({ item, isActive, hovered }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      outline: hovered
        ? '1px solid rgba(28,28,28,0.28)'
        : isActive
          ? '1px solid rgba(28,28,28,0.1)'
          : '1px solid rgba(28,28,28,0.05)',
      transition: 'outline-color 0.2s ease',
      position: 'relative',
    }}>
      <div style={{ flex: '1 1 0', overflow: 'hidden' }}>
        {item.image
          ? <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', background: item.color }} />
        }
      </div>

      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(clamp(52px, 8vw, 74px) + 8px)',
          right: '12px',
          fontSize: '9px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(28,28,28,0.5)',
          background: 'var(--bone)',
          padding: '4px 8px',
        }}>
          View
        </div>
      )}

      <div style={{
        padding: 'clamp(10px, 1.5vw, 16px) clamp(12px, 2vw, 20px)',
        borderTop: '1px solid rgba(28,28,28,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        background: '#fff',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          fontSize: 'clamp(13px, 1.6vw, 17px)',
          fontWeight: 400,
          lineHeight: 1.2,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
        }}>
          {item.title}
        </span>
        <span style={{
          fontSize: 'clamp(9px, 1vw, 11px)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-mid)',
          fontWeight: 400,
        }}>
          {item.artist}{item.collective ? ` / ${item.collective}` : ''}&nbsp;·&nbsp;{item.year}
        </span>
      </div>
    </div>
  )
}

export default function Inward({ items, onSelect, onCameraZ }) {
  const [cameraZ, setCameraZ] = useState(0)
  const [showHint, setShowHint] = useState(true)
  const rafRef = useRef(null)
  const targetCameraZ = useRef(0)
  const hasScrolled = useRef(false)

  const totalDepth = (items.length - 1) * Z_SPACING
  const maxScroll = totalDepth + Z_SPACING

  const advance = useCallback((delta) => {
    if (!hasScrolled.current) {
      hasScrolled.current = true
      setShowHint(false)
    }
    targetCameraZ.current = Math.min(maxScroll, Math.max(0, targetCameraZ.current + delta))
  }, [maxScroll])

  const handleWheel = useCallback((e) => { advance(e.deltaY * 0.8) }, [advance])

  const touchStartY = useRef(null)
  const handleTouchStart = useCallback((e) => { touchStartY.current = e.touches[0].clientY }, [])
  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === null) return
    advance((touchStartY.current - e.touches[0].clientY) * 2.34)
    touchStartY.current = e.touches[0].clientY
  }, [advance])

  useEffect(() => {
    let current = 0
    function animate() {
      current += (targetCameraZ.current - current) * 0.1
      setCameraZ(current)
      onCameraZ?.(current)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: 'calc(100% - var(--above-h))',
        perspective: '860px',
        perspectiveOrigin: '50% 50%',
        overflow: 'hidden',
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        transformStyle: 'preserve-3d',
        transform: `translateZ(${cameraZ}px)`,
        pointerEvents: 'none',
      }}>
        {items.map((item, i) => (
          <CardMesh key={item.id} item={item} index={i} cameraZ={cameraZ} onSelect={onSelect} />
        ))}
      </div>

      <div style={{
        position: 'absolute',
        bottom: 'clamp(20px, 3vw, 32px)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        opacity: showHint ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '1px',
          height: 'clamp(24px, 3vw, 36px)',
          background: 'linear-gradient(to bottom, transparent, var(--ink-faint))',
        }} />
        <span style={{
          fontSize: '9px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}>
          Scroll to explore
        </span>
      </div>
    </div>
  )
}
