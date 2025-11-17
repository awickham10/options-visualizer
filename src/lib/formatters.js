/**
 * Data Formatting Utilities
 *
 * Pure functions for consistent formatting of prices, numbers, dates, and percentages
 * across the application. Ensures uniform display and localization.
 */

/**
 * Format a number as a currency value (USD)
 *
 * @param {number} value - Numeric value to format
 * @param {number} decimals - Number of decimal places (default 2)
 * @param {boolean} includeSymbol - Include $ symbol (default true)
 * @returns {string} Formatted currency string
 *
 * @example
 * formatPrice(150.5) // Returns "$150.50"
 * formatPrice(150.5, 2, false) // Returns "150.50"
 * formatPrice(0.05, 3) // Returns "$0.050"
 */
export function formatPrice(value, decimals = 2, includeSymbol = true) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return includeSymbol ? '$0.00' : '0.00'
  }

  const formatted = value.toFixed(decimals)
  return includeSymbol ? `$${formatted}` : formatted
}

/**
 * Format a number as a percentage
 *
 * @param {number} value - Decimal value (0.05 = 5%)
 * @param {number} decimals - Number of decimal places (default 2)
 * @param {boolean} includeSign - Include + for positive values (default false)
 * @returns {string} Formatted percentage string
 *
 * @example
 * formatPercent(0.055) // Returns "5.50%"
 * formatPercent(0.055, 1) // Returns "5.5%"
 * formatPercent(0.055, 2, true) // Returns "+5.50%"
 * formatPercent(-0.02, 2, true) // Returns "-2.00%"
 */
export function formatPercent(value, decimals = 2, includeSign = false) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return '0.00%'
  }

  const percentValue = value * 100
  const formatted = percentValue.toFixed(decimals)
  const sign = includeSign && percentValue > 0 ? '+' : ''

  return `${sign}${formatted}%`
}

/**
 * Format a large number with thousand separators
 *
 * @param {number} value - Numeric value to format
 * @param {number} decimals - Number of decimal places (default 0)
 * @returns {string} Formatted number with commas
 *
 * @example
 * formatNumber(1234567) // Returns "1,234,567"
 * formatNumber(1234.56, 2) // Returns "1,234.56"
 */
export function formatNumber(value, decimals = 0) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return '0'
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Format a date as a readable string
 *
 * @param {Date|string} date - Date object or ISO string
 * @param {string} format - Format style ('short', 'medium', 'long')
 * @returns {string} Formatted date string
 *
 * @example
 * formatDate(new Date('2025-12-19'), 'short') // Returns "Dec 19"
 * formatDate(new Date('2025-12-19'), 'medium') // Returns "Dec 19, 2025"
 * formatDate(new Date('2025-12-19'), 'long') // Returns "December 19, 2025"
 */
export function formatDate(date, format = 'medium') {
  let dateObj = date

  // Convert string to Date if needed
  if (typeof date === 'string') {
    dateObj = new Date(date)
  }

  // Validate date
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Invalid Date'
  }

  const options = {}

  switch (format) {
    case 'short':
      options.month = 'short'
      options.day = 'numeric'
      break
    case 'medium':
      options.month = 'short'
      options.day = 'numeric'
      options.year = 'numeric'
      break
    case 'long':
      options.month = 'long'
      options.day = 'numeric'
      options.year = 'numeric'
      break
    default:
      options.month = 'short'
      options.day = 'numeric'
      options.year = 'numeric'
  }

  return dateObj.toLocaleDateString('en-US', options)
}

/**
 * Format a date as uppercase short form (for labels)
 *
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Uppercase formatted date (e.g., "DEC 19")
 *
 * @example
 * formatDateLabel(new Date('2025-12-19')) // Returns "DEC 19"
 */
export function formatDateLabel(date) {
  return formatDate(date, 'short').toUpperCase()
}

/**
 * Format a date as ISO date string (YYYY-MM-DD)
 *
 * @param {Date} date - Date object
 * @returns {string} ISO date string
 *
 * @example
 * formatISODate(new Date('2025-12-19')) // Returns "2025-12-19"
 */
export function formatISODate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().split('T')[0]
}

/**
 * Format a time as HH:MM:SS
 *
 * @param {Date|string} date - Date object or ISO string
 * @param {boolean} includeSeconds - Include seconds (default true)
 * @returns {string} Formatted time string
 *
 * @example
 * formatTime(new Date('2025-12-19T15:30:45')) // Returns "3:30:45 PM"
 * formatTime(new Date('2025-12-19T15:30:45'), false) // Returns "3:30 PM"
 */
export function formatTime(date, includeSeconds = true) {
  let dateObj = date

  if (typeof date === 'string') {
    dateObj = new Date(date)
  }

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Invalid Time'
  }

  const options = {
    hour: 'numeric',
    minute: '2-digit'
  }

  if (includeSeconds) {
    options.second = '2-digit'
  }

  return dateObj.toLocaleTimeString('en-US', options)
}

/**
 * Format implied volatility as percentage
 *
 * @param {number} iv - Implied volatility (decimal, e.g., 0.25 = 25%)
 * @returns {string} Formatted IV string
 *
 * @example
 * formatIV(0.2534) // Returns "25.3%"
 */
export function formatIV(iv) {
  if (typeof iv !== 'number' || !isFinite(iv)) {
    return 'N/A'
  }

  return `${(iv * 100).toFixed(1)}%`
}

/**
 * Format a Greek value with appropriate precision
 *
 * @param {number} value - Greek value
 * @param {string} greekType - Type of Greek ('delta', 'gamma', 'theta', 'vega')
 * @returns {string} Formatted Greek value
 *
 * @example
 * formatGreek(0.5234, 'delta') // Returns "0.523"
 * formatGreek(0.00123, 'gamma') // Returns "0.0012"
 */
export function formatGreek(value, greekType) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return 'N/A'
  }

  let decimals = 3

  switch (greekType) {
    case 'gamma':
    case 'vega':
      decimals = 4
      break
    case 'theta':
      decimals = 3
      break
    case 'delta':
    default:
      decimals = 3
  }

  return value.toFixed(decimals)
}

/**
 * Format bid-ask spread
 *
 * @param {number} bid - Bid price
 * @param {number} ask - Ask price
 * @returns {string} Formatted bid-ask spread
 *
 * @example
 * formatBidAsk(1.50, 1.55) // Returns "$1.50 × $1.55"
 */
export function formatBidAsk(bid, ask) {
  const bidStr = formatPrice(bid)
  const askStr = formatPrice(ask)
  return `${bidStr} × ${askStr}`
}

/**
 * Format spread width as absolute and percentage
 *
 * @param {number} bid - Bid price
 * @param {number} ask - Ask price
 * @returns {string} Formatted spread width
 *
 * @example
 * formatSpreadWidth(1.50, 1.60) // Returns "$0.10 (6.5%)"
 */
export function formatSpreadWidth(bid, ask) {
  if (typeof bid !== 'number' || typeof ask !== 'number' || bid === 0 || ask === 0) {
    return 'N/A'
  }

  const width = ask - bid
  const midpoint = (bid + ask) / 2
  const percentWidth = (width / midpoint) * 100

  return `${formatPrice(width)} (${percentWidth.toFixed(1)}%)`
}

/**
 * Format volume with abbreviations for large numbers
 *
 * @param {number} volume - Volume value
 * @returns {string} Formatted volume (e.g., "1.2K", "3.5M")
 *
 * @example
 * formatVolume(1234) // Returns "1.2K"
 * formatVolume(1234567) // Returns "1.2M"
 * formatVolume(123) // Returns "123"
 */
export function formatVolume(volume) {
  if (typeof volume !== 'number' || !isFinite(volume)) {
    return '0'
  }

  if (volume === 0) {
    return '0'
  }

  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`
  }

  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`
  }

  return volume.toString()
}

/**
 * Format P/L (profit/loss) with color indication
 *
 * @param {number} value - P/L value
 * @param {boolean} asPercent - Format as percentage (default false)
 * @returns {Object} Object with formatted value and color
 *
 * @example
 * formatPL(150.50) // Returns { value: "+$150.50", color: "green" }
 * formatPL(-25.30) // Returns { value: "-$25.30", color: "red" }
 * formatPL(0.05, true) // Returns { value: "+5.00%", color: "green" }
 */
export function formatPL(value, asPercent = false) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return { value: asPercent ? '0.00%' : '$0.00', color: 'neutral' }
  }

  const sign = value > 0 ? '+' : ''
  const formatted = asPercent
    ? `${sign}${formatPercent(value, 2, false)}`
    : `${sign}${formatPrice(Math.abs(value))}`

  const color = value > 0 ? 'green' : value < 0 ? 'red' : 'neutral'

  return { value: formatted, color }
}

/**
 * Format a compact number for chart labels
 *
 * @param {number} value - Numeric value
 * @returns {string} Compact formatted number
 *
 * @example
 * formatCompact(1234) // Returns "1.2K"
 * formatCompact(1234567) // Returns "1.2M"
 * formatCompact(12.34) // Returns "12.3"
 */
export function formatCompact(value) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return '0'
  }

  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }

  return value.toFixed(1)
}
