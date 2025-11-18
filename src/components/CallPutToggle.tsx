export type OptionType = 'call' | 'put'

interface OptionTypeOption {
  id: OptionType
  label: string
}

export interface CallPutToggleProps {
  optionType: OptionType
  onTypeChange: (type: OptionType) => void
}

export function CallPutToggle({ optionType, onTypeChange }: CallPutToggleProps) {
  const types: OptionTypeOption[] = [
    { id: 'call', label: 'Calls' },
    { id: 'put', label: 'Puts' }
  ]

  return (
    <div
      className="inline-flex bg-white"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {types.map((t, idx) => (
        <button
          key={t.id}
          onClick={() => onTypeChange(t.id)}
          className="px-6 py-3 text-[10px] uppercase tracking-[0.15em] font-semibold transition-all duration-200"
          style={{
            background: optionType === t.id ? 'var(--color-accent)' : 'transparent',
            color: optionType === t.id ? 'white' : 'var(--color-text-secondary)',
            borderRight: idx < types.length - 1 ? '1px solid var(--color-border)' : 'none',
            fontFamily: 'DM Sans, sans-serif'
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
