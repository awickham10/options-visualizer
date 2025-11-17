/**
 * Unit tests for formatters.js
 */

import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatPercent,
  formatNumber,
  formatDate,
  formatDateLabel,
  formatISODate,
  formatTime,
  formatIV,
  formatGreek,
  formatBidAsk,
  formatVolume,
  formatPL,
  formatCompact
} from '../formatters'

describe('formatPrice', () => {
  it('should format price with dollar sign', () => {
    expect(formatPrice(150.50)).toBe('$150.50')
    expect(formatPrice(1000.99)).toBe('$1000.99')
  })

  it('should format price without dollar sign when requested', () => {
    expect(formatPrice(150.50, 2, false)).toBe('150.50')
  })

  it('should handle custom decimal places', () => {
    expect(formatPrice(150.5, 3)).toBe('$150.500')
    expect(formatPrice(150.123, 1)).toBe('$150.1')
  })

  it('should handle zero and negative values', () => {
    expect(formatPrice(0)).toBe('$0.00')
    expect(formatPrice(-50.25)).toBe('$-50.25')
  })

  it('should handle invalid inputs', () => {
    expect(formatPrice(NaN)).toBe('$0.00')
    expect(formatPrice(Infinity)).toBe('$0.00')
  })
})

describe('formatPercent', () => {
  it('should format decimal as percentage', () => {
    expect(formatPercent(0.055)).toBe('5.50%')
    expect(formatPercent(0.1)).toBe('10.00%')
  })

  it('should include plus sign when requested', () => {
    expect(formatPercent(0.055, 2, true)).toBe('+5.50%')
    expect(formatPercent(-0.02, 2, true)).toBe('-2.00%')
  })

  it('should handle custom decimal places', () => {
    expect(formatPercent(0.055, 1)).toBe('5.5%')
    expect(formatPercent(0.055, 3)).toBe('5.500%')
  })

  it('should handle zero', () => {
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('should handle invalid inputs', () => {
    expect(formatPercent(NaN)).toBe('0.00%')
  })
})

describe('formatNumber', () => {
  it('should format number with thousand separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(1000)).toBe('1,000')
  })

  it('should handle decimal places', () => {
    expect(formatNumber(1234.56, 2)).toBe('1,234.56')
  })

  it('should handle small numbers', () => {
    expect(formatNumber(123)).toBe('123')
  })

  it('should handle invalid inputs', () => {
    expect(formatNumber(NaN)).toBe('0')
  })
})

describe('formatDate', () => {
  it('should format date in short format', () => {
    const date = new Date('2025-12-19')
    const formatted = formatDate(date, 'short')

    expect(formatted).toContain('Dec')
    expect(formatted).toContain('19')
    expect(formatted).not.toContain('2025')
  })

  it('should format date in medium format', () => {
    const date = new Date('2025-12-19')
    const formatted = formatDate(date, 'medium')

    expect(formatted).toContain('Dec')
    expect(formatted).toContain('19')
    expect(formatted).toContain('2025')
  })

  it('should format date in long format', () => {
    const date = new Date('2025-12-19')
    const formatted = formatDate(date, 'long')

    expect(formatted).toContain('December')
    expect(formatted).toContain('19')
    expect(formatted).toContain('2025')
  })

  it('should handle ISO date strings', () => {
    const formatted = formatDate('2025-12-19', 'medium')

    expect(formatted).toContain('Dec')
    expect(formatted).toContain('2025')
  })

  it('should handle invalid dates', () => {
    expect(formatDate('invalid')).toBe('Invalid Date')
    expect(formatDate(null)).toBe('Invalid Date')
  })
})

describe('formatDateLabel', () => {
  it('should format date as uppercase short label', () => {
    const date = new Date('2025-12-19')
    const label = formatDateLabel(date)

    expect(label).toContain('DEC')
    expect(label).toContain('19')
    expect(label).toMatch(/^[A-Z]/)) // Starts with uppercase
  })
})

describe('formatISODate', () => {
  it('should format date as ISO string', () => {
    const date = new Date('2025-12-19')
    const iso = formatISODate(date)

    expect(iso).toBe('2025-12-19')
  })

  it('should handle invalid dates', () => {
    expect(formatISODate(new Date('invalid'))).toBe('')
    expect(formatISODate(null)).toBe('')
  })
})

describe('formatTime', () => {
  it('should format time with seconds', () => {
    const date = new Date('2025-12-19T15:30:45')
    const time = formatTime(date, true)

    expect(time).toContain('3:30')
    expect(time).toContain('45')
    expect(time).toContain('PM')
  })

  it('should format time without seconds', () => {
    const date = new Date('2025-12-19T15:30:45')
    const time = formatTime(date, false)

    expect(time).toContain('3:30')
    expect(time).not.toContain('45')
    expect(time).toContain('PM')
  })

  it('should handle ISO strings', () => {
    const time = formatTime('2025-12-19T15:30:45')

    expect(time).toContain('PM')
  })

  it('should handle invalid times', () => {
    expect(formatTime('invalid')).toBe('Invalid Time')
  })
})

describe('formatIV', () => {
  it('should format implied volatility as percentage', () => {
    expect(formatIV(0.2534)).toBe('25.3%')
    expect(formatIV(0.50)).toBe('50.0%')
  })

  it('should handle invalid inputs', () => {
    expect(formatIV(NaN)).toBe('N/A')
    expect(formatIV(null)).toBe('N/A')
  })
})

describe('formatGreek', () => {
  it('should format delta with 3 decimals', () => {
    expect(formatGreek(0.5234, 'delta')).toBe('0.523')
  })

  it('should format gamma with 4 decimals', () => {
    expect(formatGreek(0.00123, 'gamma')).toBe('0.0012')
  })

  it('should format theta with 3 decimals', () => {
    expect(formatGreek(-0.0543, 'theta')).toBe('-0.054')
  })

  it('should format vega with 4 decimals', () => {
    expect(formatGreek(0.1234, 'vega')).toBe('0.1234')
  })

  it('should handle invalid inputs', () => {
    expect(formatGreek(NaN, 'delta')).toBe('N/A')
  })
})

describe('formatBidAsk', () => {
  it('should format bid-ask spread', () => {
    const formatted = formatBidAsk(1.50, 1.55)

    expect(formatted).toContain('$1.50')
    expect(formatted).toContain('$1.55')
    expect(formatted).toContain('×')
  })
})

describe('formatVolume', () => {
  it('should format large volumes with K suffix', () => {
    expect(formatVolume(1234)).toBe('1.2K')
    expect(formatVolume(5678)).toBe('5.7K')
  })

  it('should format very large volumes with M suffix', () => {
    expect(formatVolume(1234567)).toBe('1.2M')
    expect(formatVolume(5678901)).toBe('5.7M')
  })

  it('should not format small volumes', () => {
    expect(formatVolume(123)).toBe('123')
    expect(formatVolume(999)).toBe('999')
  })

  it('should handle zero', () => {
    expect(formatVolume(0)).toBe('0')
  })

  it('should handle invalid inputs', () => {
    expect(formatVolume(NaN)).toBe('0')
  })
})

describe('formatPL', () => {
  it('should format positive P/L with color', () => {
    const result = formatPL(150.50)

    expect(result.value).toContain('+')
    expect(result.value).toContain('$150.50')
    expect(result.color).toBe('green')
  })

  it('should format negative P/L with color', () => {
    const result = formatPL(-25.30)

    expect(result.value).toContain('-')
    expect(result.value).toContain('$25.30')
    expect(result.color).toBe('red')
  })

  it('should format zero P/L as neutral', () => {
    const result = formatPL(0)

    expect(result.color).toBe('neutral')
  })

  it('should format as percentage when requested', () => {
    const result = formatPL(0.05, true)

    expect(result.value).toContain('%')
    expect(result.value).toContain('+')
  })
})

describe('formatCompact', () => {
  it('should format large numbers compactly', () => {
    expect(formatCompact(1234)).toBe('1.2K')
    expect(formatCompact(1234567)).toBe('1.2M')
  })

  it('should format small numbers with decimal', () => {
    expect(formatCompact(12.34)).toBe('12.3')
  })

  it('should handle invalid inputs', () => {
    expect(formatCompact(NaN)).toBe('0')
  })
})
