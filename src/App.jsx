import { useState, useCallback, useRef } from 'react'
import { items } from './data.js'
import Inward from './components/Inward.jsx'
import Above from './components/Above.jsx'
import Observation from './components/Observation.jsx'

const Z_SPACING = 680

export default function App() {
  const [mode, setMode] = useState('journey')
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleCameraZ = useCallback((z) => {
    const idx = Math.round(z / Z_SPACING)
    setActiveIndex(Math.min(items.length - 1, Math.max(0, idx)))
  }, [])

  const handleSelect = useCallback((item) => {
    setSelectedItem(item)
    setMode('observation')
  }, [])

  const handleBack = useCallback(() => {
    setMode('journey')
  }, [])

  const isJourney = mode === 'journey'

  return (
    <>
      {/* Archive label — top left */}
      <div style={{
        position: 'fixed',
        top: 'clamp(16px, 2.5vw, 28px)',
        left: 'clamp(16px, 3vw, 36px)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        pointerEvents: 'none',
        opacity: isJourney ? 1 : 0,
        transition: 'opacity 0.22s ease',
      }}>
        <span style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          fontSize: 'clamp(13px, 1.6vw, 17px)',
          fontWeight: 400,
          letterSpacing: '0.01em',
          color: 'var(--ink)',
          lineHeight: 1,
        }}>
          Astro Art
        </span>
        <span style={{
          fontSize: 'clamp(8px, 0.9vw, 10px)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
          fontWeight: 400,
        }}>
          Archive
        </span>
      </div>

      {/* Mode label — top right */}
      <div style={{
        position: 'fixed',
        top: 'clamp(16px, 2.5vw, 28px)',
        right: 'clamp(16px, 3vw, 36px)',
        zIndex: 200,
        pointerEvents: 'none',
        opacity: isJourney ? 1 : 0,
        transition: 'opacity 0.22s ease',
      }}>
        <span style={{
          fontSize: 'clamp(8px, 0.9vw, 10px)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}>
          Journey
        </span>
      </div>

      {/*
        Inward stays mounted at all times — wrapping div opacity hides it
        during Observation. Because the wrapper creates a stacking context,
        the position:fixed children inside are composited at opacity 0
        and are fully invisible + non-interactive while we're away.
      */}
      <div style={{
        opacity: isJourney ? 1 : 0,
        pointerEvents: isJourney ? 'auto' : 'none',
        transition: 'opacity 0.22s ease',
      }}>
        <Inward
          items={items}
          onSelect={handleSelect}
          onCameraZ={handleCameraZ}
        />
      </div>

      {/* Observation fades in over the hidden Journey */}
      <div style={{
        opacity: isJourney ? 0 : 1,
        pointerEvents: isJourney ? 'none' : 'auto',
        transition: 'opacity 0.22s ease',
      }}>
        {selectedItem && <Observation item={selectedItem} />}
      </div>

      <Above mode={mode} items={items} activeIndex={activeIndex} onBack={handleBack} />
    </>
  )
}
