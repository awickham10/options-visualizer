/**
 * Data Formatting Utilities
 *
 * Pure functions for consistent formatting of prices, numbers, dates, and percentages
 * across the application. Ensures uniform display and localization.
 */

type DateFormat = 'short' | 'medium' | 'long'
type GreekType = 'delta' | 'gamma' | 'theta' | 'vega' | 'rho'

/**
 * Format a number as a currency value (USD)
 */
export function formatPrice(value: number, decimals: number = 2, includeSymbol: boolean = true): string {
  if (typeof value !== 'number' || !isFinite(value)) {
    return includeSymbol ? '$0.00' : '0.00'
  }

  const formatted = value.toFixed(decimals)
  return includeSymbol ? `$${formatted}` : formatted
}

/**
 * Format a number as a percentage
 */
export function formatPercent(value: number, decimals: number = 2, includeSign: boolean = false): string {
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
 */
export function formatNumber(value: number, decimals: number = 0): string {
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
 */
export function formatDate(date: Date | string, format: DateFormat = 'medium'): string {
  let dateObj = date

  // Convert string to Date if needed
  if (typeof date === 'string') {
    dateObj = new Date(date)
  }

  // Validate date
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Invalid Date'
  }

  const options: Intl.DateTimeFormatOptions = {}

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
 */
export function formatDateLabel(date: Date | string): string {
  return formatDate(date, 'short').toUpperCase()
}

/**
 * Format a date as ISO date string (YYYY-MM-DD)
 */
export function formatISODate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().split('T')[0]
}

/**
 * Format a time as HH:MM:SS
 */
export function formatTime(date: Date | string, includeSeconds: boolean = true): string {
  let dateObj = date

  if (typeof date === 'string') {
    dateObj = new Date(date)
  }

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Invalid Time'
  }

  const options: Intl.DateTimeFormatOptions = {
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
 */
export function formatIV(iv: number): string {
  if (typeof iv !== 'number' || !isFinite(iv)) {
    return 'N/A'
  }

  return `${(iv * 100).toFixed(1)}%`
}

/**
 * Format a Greek value with appropriate precision
 */
export function formatGreek(value: number, greekType: GreekType): string {
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
 */
export function formatBidAsk(bid: number, ask: number): string {
  const bidStr = formatPrice(bid)
  const askStr = formatPrice(ask)
  return `${bidStr} × ${askStr}`
}

/**
 * Format spread width as absolute and percentage
 */
export function formatSpreadWidth(bid: number, ask: number): string {
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
 */
export function formatVolume(volume: number): string {
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

interface PLResult {
  value: string
  color: 'green' | 'red' | 'neutral'
}

/**
 * Format P/L (profit/loss) with color indication
 */
export function formatPL(value: number, asPercent: boolean = false): PLResult {
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
 */
export function formatCompact(value: number): string {
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
