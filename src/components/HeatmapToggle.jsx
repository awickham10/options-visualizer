import React from 'react'

export function HeatmapToggle({ mode, onModeChange }) {
  const modes = [
    { id: 'volume', label: 'Volume' },
    { id: 'iv', label: 'Implied Vol' },
    { id: 'oi', label: 'Open Interest' }
  ]

  return (
    <div
      className="inline-flex bg-white"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {modes.map((m, idx) => (
        <button
          key={m.id}
          onClick={() => onModeChange(m.id)}
          className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-semibold transition-all duration-200"
          style={{
            background: mode === m.id ? 'var(--color-accent)' : 'transparent',
            color: mode === m.id ? 'white' : 'var(--color-text-secondary)',
            borderRight: idx < modes.length - 1 ? '1px solid var(--color-border)' : 'none',
            fontFamily: 'DM Sans, sans-serif'
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
