/**
 * Unit tests for chartUtils.js
 */

import { describe, it, expect } from 'vitest'
import {
  priceToRowY,
  percentile,
  normalize,
  calculateIntensityRange,
  getHeatmapColor,
  sampleArray,
  calculateLabelInterval
} from '../chartUtils'

describe('priceToRowY', () => {
  const strikes = [155, 150, 145, 140, 135] // Descending order
  const marginTop = 60
  const cellHeight = 30

  it('should calculate Y position for price within range', () => {
    const y = priceToRowY(147.5, strikes, marginTop, cellHeight)

    // Should be between 150 and 145 strike rows
    const row150Y = marginTop + (1 * cellHeight) + (cellHeight / 2)
    const row145Y = marginTop + (2 * cellHeight) + (cellHeight / 2)

    expect(y).toBeGreaterThan(row150Y)
    expect(y).toBeLessThan(row145Y)
  })

  it('should handle price at exact strike', () => {
    const y = priceToRowY(150, strikes, marginTop, cellHeight)

    const row150Y = marginTop + (1 * cellHeight) + (cellHeight / 2)
    expect(y).toBe(row150Y)
  })

  it('should handle price above all strikes', () => {
    const y = priceToRowY(160, strikes, marginTop, cellHeight)

    const topRowY = marginTop + (cellHeight / 2)
    expect(y).toBe(topRowY)
  })

  it('should handle price below all strikes', () => {
    const y = priceToRowY(130, strikes, marginTop, cellHeight)

    const bottomRowY = marginTop + ((strikes.length - 1) * cellHeight) + (cellHeight / 2)
    expect(y).toBe(bottomRowY)
  })

  it('should handle empty strikes array', () => {
    const y = priceToRowY(150, [], marginTop, cellHeight)
    expect(y).toBe(marginTop)
  })

  it('should handle invalid price', () => {
    const y = priceToRowY(NaN, strikes, marginTop, cellHeight)
    expect(y).toBe(marginTop)
  })
})

describe('percentile', () => {
  it('should calculate median (50th percentile)', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const median = percentile(values, 50)

    expect(median).toBe(5.5)
  })

  it('should calculate 95th percentile', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const p95 = percentile(values, 95)

    expect(p95).toBeCloseTo(9.55, 1)
  })

  it('should handle single value array', () => {
    expect(percentile([5], 50)).toBe(5)
    expect(percentile([5], 95)).toBe(5)
  })

  it('should handle empty array', () => {
    expect(percentile([], 50)).toBe(0)
  })

  it('should handle out of range percentiles', () => {
    const values = [1, 2, 3, 4, 5]
    expect(percentile(values, -10)).toBe(0)
    expect(percentile(values, 150)).toBe(0)
  })

  it('should not modify original array', () => {
    const values = [5, 2, 8, 1, 9]
    const original = [...values]
    percentile(values, 50)

    expect(values).toEqual(original)
  })
})

describe('normalize', () => {
  it('should normalize value to 0-1 range', () => {
    expect(normalize(50, 0, 100)).toBe(0.5)
    expect(normalize(0, 0, 100)).toBe(0)
    expect(normalize(100, 0, 100)).toBe(1)
  })

  it('should clamp values above max to 1', () => {
    expect(normalize(150, 0, 100)).toBe(1)
  })

  it('should clamp values below min to 0', () => {
    expect(normalize(-50, 0, 100)).toBe(0)
  })

  it('should handle min equals max', () => {
    expect(normalize(5, 5, 5)).toBe(0)
  })
})

describe('calculateIntensityRange', () => {
  const cells = [
    { volume: 100, impliedVolatility: 0.2, openInterest: 500 },
    { volume: 500, impliedVolatility: 0.5, openInterest: 1000 },
    { volume: 1000, impliedVolatility: 0.8, openInterest: 2000 },
    { volume: 2000, impliedVolatility: 1.0, openInterest: 5000 }
  ]

  it('should calculate range for volume mode', () => {
    const range = calculateIntensityRange(cells, 'volume')

    expect(range.min).toBeGreaterThanOrEqual(0)
    expect(range.max).toBeGreaterThan(range.min)
  })

  it('should calculate range for IV mode', () => {
    const range = calculateIntensityRange(cells, 'iv')

    expect(range.min).toBeGreaterThanOrEqual(0)
    expect(range.max).toBeGreaterThan(0)
  })

  it('should handle empty cells array', () => {
    const range = calculateIntensityRange([], 'volume')

    expect(range.min).toBe(0)
    expect(range.max).toBe(1)
  })

  it('should filter out null cells', () => {
    const cellsWithNull = [...cells, null, undefined]
    const range = calculateIntensityRange(cellsWithNull, 'volume')

    expect(range).toBeTruthy()
  })
})

describe('getHeatmapColor', () => {
  it('should return light gray for zero intensity', () => {
    expect(getHeatmapColor(0)).toBe('#FAFAFA')
  })

  it('should return blue for blue scheme', () => {
    const color = getHeatmapColor(0.5, 'blue')

    expect(color).toContain('rgb')
    expect(color).toContain('255') // Has blue component
  })

  it('should return red for red scheme', () => {
    const color = getHeatmapColor(0.5, 'red')

    expect(color).toContain('rgb')
    // Red channel should be 255
  })

  it('should clamp intensity to 0-1 range', () => {
    // Should not throw for out of range values
    expect(getHeatmapColor(-0.5)).toBe('#FAFAFA')
    expect(getHeatmapColor(1.5)).toBeTruthy()
  })

  it('should default to blue scheme', () => {
    const defaultColor = getHeatmapColor(0.5)
    const blueColor = getHeatmapColor(0.5, 'blue')

    expect(defaultColor).toBe(blueColor)
  })
})

describe('sampleArray', () => {
  it('should sample every nth element', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    const sampled = sampleArray(arr, 2)

    expect(sampled).toEqual([1, 3, 5, 7])
  })

  it('should handle interval of 1', () => {
    const arr = [1, 2, 3, 4, 5]
    const sampled = sampleArray(arr, 1)

    expect(sampled).toEqual(arr)
  })

  it('should handle empty array', () => {
    expect(sampleArray([], 2)).toEqual([])
  })

  it('should handle non-array input', () => {
    expect(sampleArray(null, 2)).toEqual([])
    expect(sampleArray(undefined, 2)).toEqual([])
  })
})

describe('calculateLabelInterval', () => {
  it('should calculate appropriate interval for many items', () => {
    const interval = calculateLabelInterval(100, 500, 25)

    expect(interval).toBeGreaterThan(1)
    expect(interval).toBeLessThanOrEqual(100)
  })

  it('should return 1 for few items', () => {
    const interval = calculateLabelInterval(10, 500, 25)

    expect(interval).toBe(1)
  })

  it('should prevent division by zero', () => {
    const interval = calculateLabelInterval(100, 0, 25)

    expect(interval).toBeGreaterThan(0)
  })
})
