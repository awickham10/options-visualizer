/**
 * Options Contract Utilities
 *
 * Pure functions for parsing and validating options contract symbols.
 * Contract symbol format: SYMBOL + YYMMDD + C/P + 00000000 (strike * 1000)
 * Example: AAPL251219C00150000 = AAPL Dec 19, 2025 Call @ $150.00
 */

import { logger } from './logger'

type OptionType = 'C' | 'P'
type Moneyness = 'ITM' | 'ATM' | 'OTM'

export interface ParsedContract {
  symbol: string
  expirationDate: Date
  optionType: OptionType
  strike: number
  contractSymbol: string
}

export interface OptionData {
  strike: number
  expDate: Date | string
  optionType: OptionType
  [key: string]: unknown
}

/**
 * Regular expression for validating and parsing OCC option contract symbols
 * Groups: [symbol, dateYYMMDD, C/P, strikePriceInteger]
 */
export const OCC_CONTRACT_REGEX = /^([A-Z]+)(\d{6})([CP])(\d{8})$/

/**
 * Parse an OCC options contract symbol into its components
 */
export function parseContractSymbol(contractSymbol: string): ParsedContract | null {
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
      optionType: optionType as OptionType,
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
 */
export function isValidContractSymbol(contractSymbol: string): boolean {
  return parseContractSymbol(contractSymbol) !== null
}

/**
 * Format a contract symbol as a human-readable string
 */
export function formatContractSymbol(contractSymbol: string): string {
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
 */
export function isITM(strike: number, currentPrice: number, optionType: OptionType | string): boolean {
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
 */
export function isATM(strike: number, currentPrice: number, tolerance: number = 0.005): boolean {
  if (typeof strike !== 'number' || typeof currentPrice !== 'number') {
    return false
  }

  const diff = Math.abs(currentPrice - strike)
  const threshold = strike * tolerance

  return diff <= threshold
}

/**
 * Determine option moneyness category
 */
export function getMoneyness(strike: number, currentPrice: number, optionType: OptionType | string): Moneyness {
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
 */
export function calculateDTE(expirationDate: Date, currentDate: Date = new Date()): number {
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
 */
export function isValidOptionData(option: unknown): option is OptionData {
  if (!option || typeof option !== 'object') {
    return false
  }

  const opt = option as Record<string, unknown>
  const requiredFields = ['strike', 'expDate', 'optionType']
  return requiredFields.every(field => opt[field] !== undefined && opt[field] !== null)
}
