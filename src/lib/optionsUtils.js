/**
 * Options Contract Utilities
 *
 * Pure functions for parsing and validating options contract symbols.
 * Contract symbol format: SYMBOL + YYMMDD + C/P + 00000000 (strike * 1000)
 * Example: AAPL251219C00150000 = AAPL Dec 19, 2025 Call @ $150.00
 */

import { logger } from './logger'

/**
 * Regular expression for validating and parsing OCC option contract symbols
 * Groups: [symbol, dateYYMMDD, C/P, strikePriceInteger]
 */
export const OCC_CONTRACT_REGEX = /^([A-Z]+)(\d{6})([CP])(\d{8})$/

/**
 * Parse an OCC options contract symbol into its components
 *
 * @param {string} contractSymbol - OCC contract symbol (e.g., "AAPL251219C00150000")
 * @returns {Object|null} Parsed contract data or null if invalid
 * @returns {string} return.symbol - Underlying stock symbol
 * @returns {Date} return.expirationDate - Expiration date
 * @returns {string} return.optionType - 'C' for call, 'P' for put
 * @returns {number} return.strike - Strike price as decimal
 * @returns {string} return.contractSymbol - Original contract symbol
 *
 * @example
 * parseContractSymbol('AAPL251219C00150000')
 * // Returns: {
 * //   symbol: 'AAPL',
 * //   expirationDate: Date(2025-12-19),
 * //   optionType: 'C',
 * //   strike: 150.00,
 * //   contractSymbol: 'AAPL251219C00150000'
 * // }
 */
export function parseContractSymbol(contractSymbol) {
  if (!contractSymbol || typeof contractSymbol !== 'string') {
    return null
  }

  const match = contractSymbol.match(OCC_CONTRACT_REGEX)
  if (!match) {
    return null
  }

  const [, symbol, dateStr, optionType, strikeStr] = match

  try {
    // Parse expiration date (YYMMDD format)
    const year = 2000 + parseInt(dateStr.substring(0, 2), 10)
    const month = parseInt(dateStr.substring(2, 4), 10)
    const day = parseInt(dateStr.substring(4, 6), 10)

    // Validate date components
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null
    }

    const expirationDate = new Date(year, month - 1, day) // month is 0-indexed in Date

    // Validate date is valid (catches invalid dates like Feb 31)
    if (isNaN(expirationDate.getTime())) {
      return null
    }

    // Parse strike price (8 digits, last 3 are decimals)
    const strike = parseInt(strikeStr, 10) / 1000

    // Validate strike is positive
    if (strike <= 0 || !isFinite(strike)) {
      return null
    }

    return {
      symbol,
      expirationDate,
      optionType,
      strike,
      contractSymbol
    }
  } catch (error) {
    logger.error('Error parsing contract symbol:', contractSymbol, error)
    return null
  }
}

/**
 * Validate if a string is a valid OCC contract symbol
 *
 * @param {string} contractSymbol - Contract symbol to validate
 * @returns {boolean} True if valid OCC contract symbol
 *
 * @example
 * isValidContractSymbol('AAPL251219C00150000') // true
 * isValidContractSymbol('INVALID') // false
 */
export function isValidContractSymbol(contractSymbol) {
  return parseContractSymbol(contractSymbol) !== null
}

/**
 * Format a contract symbol as a human-readable string
 *
 * @param {string} contractSymbol - OCC contract symbol
 * @returns {string} Formatted string (e.g., "AAPL Dec 19, 2025 $150.00 Call")
 *
 * @example
 * formatContractSymbol('AAPL251219C00150000')
 * // Returns: "AAPL Dec 19, 2025 $150.00 Call"
 */
export function formatContractSymbol(contractSymbol) {
  const parsed = parseContractSymbol(contractSymbol)
  if (!parsed) {
    return contractSymbol
  }

  const { symbol, expirationDate, optionType, strike } = parsed
  const optionTypeName = optionType === 'C' ? 'Call' : 'Put'
  const dateStr = expirationDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return `${symbol} ${dateStr} $${strike.toFixed(2)} ${optionTypeName}`
}

/**
 * Determine if an option is in-the-money (ITM)
 *
 * @param {number} strike - Strike price
 * @param {number} currentPrice - Current underlying price
 * @param {string} optionType - 'C' for call, 'P' for put
 * @returns {boolean} True if option is ITM
 *
 * @example
 * isITM(150, 155, 'C') // true (call is ITM when current > strike)
 * isITM(150, 145, 'C') // false (call is OTM when current < strike)
 * isITM(150, 145, 'P') // true (put is ITM when current < strike)
 */
export function isITM(strike, currentPrice, optionType) {
  if (typeof strike !== 'number' || typeof currentPrice !== 'number') {
    return false
  }

  if (optionType === 'C') {
    return currentPrice > strike
  } else if (optionType === 'P') {
    return currentPrice < strike
  }

  return false
}

/**
 * Determine if an option is at-the-money (ATM)
 * Uses a tolerance threshold for practical purposes
 *
 * @param {number} strike - Strike price
 * @param {number} currentPrice - Current underlying price
 * @param {number} tolerance - Percentage tolerance (default 0.5%)
 * @returns {boolean} True if option is ATM within tolerance
 *
 * @example
 * isATM(150, 150.50, 0.5) // true (within 0.5% tolerance)
 * isATM(150, 155, 0.5) // false (outside tolerance)
 */
export function isATM(strike, currentPrice, tolerance = 0.005) {
  if (typeof strike !== 'number' || typeof currentPrice !== 'number') {
    return false
  }

  const diff = Math.abs(currentPrice - strike)
  const threshold = strike * tolerance

  return diff <= threshold
}

/**
 * Determine option moneyness category
 *
 * @param {number} strike - Strike price
 * @param {number} currentPrice - Current underlying price
 * @param {string} optionType - 'C' for call, 'P' for put
 * @returns {string} 'ITM', 'ATM', or 'OTM'
 *
 * @example
 * getMoneyness(150, 155, 'C') // 'ITM'
 * getMoneyness(150, 150.50, 'C') // 'ATM'
 * getMoneyness(150, 145, 'C') // 'OTM'
 */
export function getMoneyness(strike, currentPrice, optionType) {
  if (isATM(strike, currentPrice)) {
    return 'ATM'
  }
  if (isITM(strike, currentPrice, optionType)) {
    return 'ITM'
  }
  return 'OTM'
}

/**
 * Calculate days to expiration (DTE)
 *
 * @param {Date} expirationDate - Option expiration date
 * @param {Date} currentDate - Current date (defaults to now)
 * @returns {number} Days until expiration (rounded down)
 *
 * @example
 * calculateDTE(new Date('2025-12-19')) // Number of days from now until Dec 19, 2025
 */
export function calculateDTE(expirationDate, currentDate = new Date()) {
  if (!(expirationDate instanceof Date) || isNaN(expirationDate.getTime())) {
    return 0
  }

  const msPerDay = 1000 * 60 * 60 * 24
  const diffMs = expirationDate.getTime() - currentDate.getTime()
  const dte = Math.floor(diffMs / msPerDay)

  return Math.max(0, dte) // Never return negative DTE
}

/**
 * Validate option data object has required fields
 *
 * @param {Object} option - Option data object
 * @returns {boolean} True if all required fields present
 */
export function isValidOptionData(option) {
  if (!option || typeof option !== 'object') {
    return false
  }

  const requiredFields = ['strike', 'expDate', 'optionType']
  return requiredFields.every(field => option[field] !== undefined && option[field] !== null)
}
