/**
 * Chart Utilities
 *
 * Pure functions for chart coordinate conversions, calculations, and statistical operations.
 * These utilities support the options visualization components.
 */

type ColorScheme = 'blue' | 'red' | 'green'
type HeatmapMode = 'volume' | 'iv' | 'oi' | 'pc' | 'delta'

interface Margins {
  left: number
  right: number
  top: number
  bottom: number
}

interface ChartDimensionsParams {
  strikeCount: number
  expirationCount: number
  cellHeight?: number
  cellWidth?: number
  margins?: Margins
  historicalWidth?: number
}

interface ChartDimensions {
  totalWidth: number
  totalHeight: number
  chartWidth: number
  chartHeight: number
  historicalWidth: number
  optionsWidth: number
  cellHeight: number
  cellWidth: number
  margins: Margins
}

interface IntensityRange {
  min: number
  max: number
}

interface OptionCell {
  volume?: number
  impliedVolatility?: number
  openInterest?: number
  pcRatioVolume?: number
  delta?: number
}

/**
 * Convert a price value to a Y-coordinate in the row-based options grid
 * Uses interpolation for accurate alignment between strike price rows
 */
export function priceToRowY(
  price: number,
  strikes: number[],
  marginTop: number,
  cellHeight: number
): number {
  if (!strikes || strikes.length === 0) {
    return marginTop
  }

  if (typeof price !== 'number' || !isFinite(price)) {
    return marginTop
  }

  // Strikes are sorted descending (highest to lowest)
  // Find the two strikes that bound this price
  let upperIdx = -1
  let lowerIdx = -1

  for (let i = 0; i < strikes.length; i++) {
    if (strikes[i] >= price) {
      upperIdx = i
    } else {
      lowerIdx = i
      break
    }
  }

  // Handle edge cases
  if (upperIdx === -1) {
    // Price is above all strikes - return top row center
    return marginTop + (cellHeight / 2)
  }
  if (lowerIdx === -1) {
    // Price is below all strikes - return bottom row center
    return marginTop + ((strikes.length - 1) * cellHeight) + (cellHeight / 2)
  }

  // Interpolate between the two strikes
  const upperStrike = strikes[upperIdx]
  const lowerStrike = strikes[lowerIdx]
  const ratio = (upperStrike - price) / (upperStrike - lowerStrike)

  const upperY = marginTop + (upperIdx * cellHeight) + (cellHeight / 2)
  const lowerY = marginTop + (lowerIdx * cellHeight) + (cellHeight / 2)

  return upperY + ratio * (lowerY - upperY)
}

/**
 * Calculate percentile value from an array of numbers
 * Uses linear interpolation between values
 */
export function percentile(arr: number[], p: number): number {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0
  }

  if (typeof p !== 'number' || p < 0 || p > 100) {
    return 0
  }

  const sorted = [...arr].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index % 1

  if (lower === upper) {
    return sorted[lower]
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/**
 * Normalize a value to 0-1 range based on min/max bounds
 * Clamps values outside the range
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) {
    return 0
  }

  const normalized = (value - min) / (max - min)
  return Math.max(0, Math.min(normalized, 1)) // Clamp to [0, 1]
}

/**
 * Calculate intensity ranges for heatmap visualization
 * Uses percentiles to handle outliers gracefully
 */
export function calculateIntensityRange(
  cells: OptionCell[],
  mode: HeatmapMode,
  lowerPercentile: number = 5,
  upperPercentile: number = 95
): IntensityRange {
  if (!Array.isArray(cells) || cells.length === 0) {
    return { min: 0, max: 1 }
  }

  const validCells = cells.filter(c => c !== null && c !== undefined)

  if (validCells.length === 0) {
    return { min: 0, max: 1 }
  }

  let values: number[] = []

  switch (mode) {
    case 'volume':
      values = validCells.map(c => c.volume || 0)
      break
    case 'iv':
      values = validCells.map(c => c.impliedVolatility || 0)
      break
    case 'oi':
      values = validCells.map(c => c.openInterest || 0)
      break
    case 'pc':
      values = validCells.map(c => c.pcRatioVolume || 0)
      break
    case 'delta':
      values = validCells.map(c => Math.abs(c.delta || 0))
      break
    default:
      values = validCells.map(c => c.volume || 0)
  }

  const min = percentile(values, lowerPercentile)
  const max = percentile(values, upperPercentile)

  // Provide sensible defaults for edge cases
  const defaultMax = (mode === 'iv' || mode === 'pc' || mode === 'delta') ? 0.01 : 1

  return {
    min,
    max: max || defaultMax
  }
}

/**
 * Calculate all intensity ranges for multiple heatmap modes at once
 * More efficient than calculating individually
 */
export function calculateIntensityRanges(
  cells: OptionCell[],
  modes: HeatmapMode[] = ['volume', 'iv', 'oi', 'pc', 'delta']
): Record<HeatmapMode, IntensityRange> {
  const ranges: Record<string, IntensityRange> = {}

  modes.forEach(mode => {
    ranges[mode] = calculateIntensityRange(cells, mode)
  })

  return ranges as Record<HeatmapMode, IntensityRange>
}

/**
 * Generate an RGB color string for heatmap visualization
 * Maps intensity (0-1) to a color gradient
 */
export function getHeatmapColor(intensity: number, colorScheme: ColorScheme = 'blue'): string {
  // Clamp intensity to [0, 1]
  const clampedIntensity = Math.max(0, Math.min(intensity, 1))

  // Return neutral color for zero intensity
  if (clampedIntensity === 0) {
    return '#FAFAFA'
  }

  let r: number, g: number, b: number

  switch (colorScheme) {
    case 'blue':
      // Blue gradient: white -> blue
      r = Math.round(255 - (255 * clampedIntensity))
      g = Math.round(255 - (184 * clampedIntensity))
      b = 255
      break
    case 'red':
      // Red gradient: white -> red
      r = 255
      g = Math.round(255 - (255 * clampedIntensity))
      b = Math.round(255 - (255 * clampedIntensity))
      break
    case 'green':
      // Green gradient: white -> green
      r = Math.round(255 - (255 * clampedIntensity))
      g = 255
      b = Math.round(255 - (255 * clampedIntensity))
      break
    default:
      // Default to blue
      r = Math.round(255 - (255 * clampedIntensity))
      g = Math.round(255 - (184 * clampedIntensity))
      b = 255
  }

  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Calculate chart dimensions based on data size
 */
export function calculateChartDimensions({
  strikeCount,
  expirationCount,
  cellHeight = 30,
  cellWidth = 80,
  margins = { left: 80, right: 40, top: 60, bottom: 100 },
  historicalWidth = 800
}: ChartDimensionsParams): ChartDimensions {
  const optionsWidth = Math.max(350, expirationCount * cellWidth)
  const chartHeight = strikeCount * cellHeight

  const totalWidth = margins.left + historicalWidth + optionsWidth + margins.right
  const totalHeight = chartHeight + margins.top + margins.bottom

  return {
    totalWidth,
    totalHeight,
    chartWidth: totalWidth - margins.left - margins.right,
    chartHeight,
    historicalWidth,
    optionsWidth,
    cellHeight,
    cellWidth,
    margins
  }
}

/**
 * Sample an array by taking every nth element
 * Useful for reducing data density in charts
 */
export function sampleArray<T>(arr: T[], interval: number = 2): T[] {
  if (!Array.isArray(arr)) {
    return []
  }

  return arr.filter((_, idx) => idx % interval === 0)
}

/**
 * Determine optimal label interval to prevent overlap
 */
export function calculateLabelInterval(
  itemCount: number,
  availableSpace: number,
  minSpacing: number
): number {
  const maxLabels = Math.floor(availableSpace / minSpacing)
  const interval = Math.max(1, Math.ceil(itemCount / maxLabels))
  return interval
}
