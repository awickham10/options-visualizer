/**
 * Chart Utilities
 *
 * Pure functions for chart coordinate conversions, calculations, and statistical operations.
 * These utilities support the options visualization components.
 */

/**
 * Convert a price value to a Y-coordinate in the row-based options grid
 * Uses interpolation for accurate alignment between strike price rows
 *
 * @param {number} price - Price value to convert
 * @param {Array<number>} strikes - Array of strike prices (sorted descending)
 * @param {number} marginTop - Top margin of chart
 * @param {number} cellHeight - Height of each cell/row
 * @returns {number} Y-coordinate in pixels
 *
 * @example
 * const strikes = [155, 150, 145, 140]
 * priceToRowY(147.5, strikes, 60, 30)
 * // Returns interpolated Y position between the 150 and 145 strike rows
 */
export function priceToRowY(price, strikes, marginTop, cellHeight) {
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
 *
 * @param {Array<number>} arr - Array of numeric values
 * @param {number} p - Percentile (0-100)
 * @returns {number} Value at the given percentile
 *
 * @example
 * percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50) // Returns 5.5 (median)
 * percentile([1, 2, 3, 4, 5], 95) // Returns 4.8
 */
export function percentile(arr, p) {
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
 *
 * @param {number} value - Value to normalize
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @returns {number} Normalized value clamped to [0, 1]
 *
 * @example
 * normalize(50, 0, 100) // Returns 0.5
 * normalize(150, 0, 100) // Returns 1.0 (clamped)
 * normalize(-10, 0, 100) // Returns 0.0 (clamped)
 */
export function normalize(value, min, max) {
  if (max === min) {
    return 0
  }

  const normalized = (value - min) / (max - min)
  return Math.max(0, Math.min(normalized, 1)) // Clamp to [0, 1]
}

/**
 * Calculate intensity ranges for heatmap visualization
 * Uses percentiles to handle outliers gracefully
 *
 * @param {Array<Object>} cells - Array of option cells with data
 * @param {string} mode - Heatmap mode ('volume', 'iv', 'oi', 'pc', 'delta')
 * @param {number} lowerPercentile - Lower percentile threshold (default 5)
 * @param {number} upperPercentile - Upper percentile threshold (default 95)
 * @returns {Object} Object with min and max values for the range
 *
 * @example
 * const cells = [{volume: 100}, {volume: 500}, {volume: 1000}]
 * calculateIntensityRange(cells, 'volume')
 * // Returns: { min: ~100, max: ~1000 }
 */
export function calculateIntensityRange(cells, mode, lowerPercentile = 5, upperPercentile = 95) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return { min: 0, max: 1 }
  }

  const validCells = cells.filter(c => c !== null && c !== undefined)

  if (validCells.length === 0) {
    return { min: 0, max: 1 }
  }

  let values = []

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
 *
 * @param {Array<Object>} cells - Array of option cells with data
 * @param {Array<string>} modes - Array of heatmap modes to calculate
 * @returns {Object} Object mapping mode names to {min, max} ranges
 *
 * @example
 * const cells = [{volume: 100, iv: 0.3}, {volume: 500, iv: 0.5}]
 * calculateIntensityRanges(cells, ['volume', 'iv'])
 * // Returns: { volume: {min: 100, max: 500}, iv: {min: 0.3, max: 0.5} }
 */
export function calculateIntensityRanges(cells, modes = ['volume', 'iv', 'oi', 'pc', 'delta']) {
  const ranges = {}

  modes.forEach(mode => {
    ranges[mode] = calculateIntensityRange(cells, mode)
  })

  return ranges
}

/**
 * Generate an RGB color string for heatmap visualization
 * Maps intensity (0-1) to a color gradient
 *
 * @param {number} intensity - Normalized intensity value (0-1)
 * @param {string} colorScheme - Color scheme ('blue', 'red', 'green')
 * @returns {string} RGB color string
 *
 * @example
 * getHeatmapColor(0) // Returns '#FAFAFA' (light gray)
 * getHeatmapColor(0.5) // Returns intermediate blue
 * getHeatmapColor(1) // Returns deep blue
 */
export function getHeatmapColor(intensity, colorScheme = 'blue') {
  // Clamp intensity to [0, 1]
  const clampedIntensity = Math.max(0, Math.min(intensity, 1))

  // Return neutral color for zero intensity
  if (clampedIntensity === 0) {
    return '#FAFAFA'
  }

  let r, g, b

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
 *
 * @param {Object} params - Parameters object
 * @param {number} params.strikeCount - Number of strike prices
 * @param {number} params.expirationCount - Number of expiration dates
 * @param {number} params.cellHeight - Height per cell (default 30)
 * @param {number} params.cellWidth - Width per cell (default 80)
 * @param {Object} params.margins - Margins object {left, right, top, bottom}
 * @returns {Object} Dimensions object with width, height, and component sizes
 *
 * @example
 * calculateChartDimensions({
 *   strikeCount: 20,
 *   expirationCount: 8,
 *   margins: { left: 80, right: 40, top: 60, bottom: 100 }
 * })
 */
export function calculateChartDimensions({
  strikeCount,
  expirationCount,
  cellHeight = 30,
  cellWidth = 80,
  margins = { left: 80, right: 40, top: 60, bottom: 100 },
  historicalWidth = 800
}) {
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
 *
 * @param {Array} arr - Array to sample
 * @param {number} interval - Sample every nth element (default 2)
 * @returns {Array} Sampled array
 *
 * @example
 * sampleArray([1, 2, 3, 4, 5, 6, 7, 8], 2) // Returns [1, 3, 5, 7]
 */
export function sampleArray(arr, interval = 2) {
  if (!Array.isArray(arr)) {
    return []
  }

  return arr.filter((_, idx) => idx % interval === 0)
}

/**
 * Determine optimal label interval to prevent overlap
 *
 * @param {number} itemCount - Total number of items
 * @param {number} availableSpace - Available space in pixels
 * @param {number} minSpacing - Minimum spacing between labels in pixels
 * @returns {number} Interval for showing labels (show every nth label)
 *
 * @example
 * calculateLabelInterval(100, 500, 25) // Returns 5 (show every 5th label)
 */
export function calculateLabelInterval(itemCount, availableSpace, minSpacing) {
  const maxLabels = Math.floor(availableSpace / minSpacing)
  const interval = Math.max(1, Math.ceil(itemCount / maxLabels))
  return interval
}
