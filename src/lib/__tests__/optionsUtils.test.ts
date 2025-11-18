/**
 * Unit tests for optionsUtils.js
 *
 * To run these tests, first install Vitest:
 * npm install -D vitest
 *
 * Add to package.json scripts:
 * "test": "vitest"
 * "test:ui": "vitest --ui"
 *
 * Then run: npm test
 */

import { describe, it, expect } from 'vitest'
import {
  parseContractSymbol,
  isValidContractSymbol,
  formatContractSymbol,
  isITM,
  isATM,
  getMoneyness,
  calculateDTE,
  isValidOptionData
} from '../optionsUtils'

describe('parseContractSymbol', () => {
  it('should parse a valid call option contract symbol', () => {
    const result = parseContractSymbol('AAPL251219C00150000')

    expect(result).toBeTruthy()
    expect(result!.symbol).toBe('AAPL')
    expect(result!.optionType).toBe('C')
    expect(result!.strike).toBe(150.00)
    expect(result!.expirationDate).toBeInstanceOf(Date)
    expect(result!.expirationDate.getFullYear()).toBe(2025)
    expect(result!.expirationDate.getMonth()).toBe(11) // December (0-indexed)
    expect(result!.expirationDate.getDate()).toBe(19)
  })

  it('should parse a valid put option contract symbol', () => {
    const result = parseContractSymbol('SPY260116P00450000')

    expect(result).toBeTruthy()
    expect(result!.symbol).toBe('SPY')
    expect(result!.optionType).toBe('P')
    expect(result!.strike).toBe(450.00)
  })

  it('should parse strike prices with decimals correctly', () => {
    const result = parseContractSymbol('TSLA250620C00275500')

    expect(result).toBeTruthy()
    expect(result!.strike).toBe(275.50)
  })

  it('should return null for invalid contract symbols', () => {
    expect(parseContractSymbol('INVALID')).toBeNull()
    expect(parseContractSymbol('AAPL251219')).toBeNull()
    expect(parseContractSymbol('')).toBeNull()
    expect(parseContractSymbol(null as any)).toBeNull()
    expect(parseContractSymbol(123 as any)).toBeNull()
  })

  it('should return null for invalid dates', () => {
    expect(parseContractSymbol('AAPL251340C00150000')).toBeNull() // Month 40
    expect(parseContractSymbol('AAPL251399C00150000')).toBeNull() // Day 99
  })

  it('should return null for zero or negative strikes', () => {
    expect(parseContractSymbol('AAPL251219C00000000')).toBeNull()
  })
})

describe('isValidContractSymbol', () => {
  it('should return true for valid symbols', () => {
    expect(isValidContractSymbol('AAPL251219C00150000')).toBe(true)
    expect(isValidContractSymbol('SPY260116P00450000')).toBe(true)
  })

  it('should return false for invalid symbols', () => {
    expect(isValidContractSymbol('INVALID')).toBe(false)
    expect(isValidContractSymbol('')).toBe(false)
    expect(isValidContractSymbol(null as any)).toBe(false)
  })
})

describe('formatContractSymbol', () => {
  it('should format a valid contract symbol as human-readable string', () => {
    const formatted = formatContractSymbol('AAPL251219C00150000')

    expect(formatted).toContain('AAPL')
    expect(formatted).toContain('$150.00')
    expect(formatted).toContain('Call')
    expect(formatted).toContain('2025')
  })

  it('should return original symbol for invalid symbols', () => {
    const invalid = 'INVALID'
    expect(formatContractSymbol(invalid)).toBe(invalid)
  })
})

describe('isITM', () => {
  it('should correctly identify ITM calls', () => {
    expect(isITM(150, 155, 'C')).toBe(true) // Current > Strike = ITM
    expect(isITM(150, 145, 'C')).toBe(false) // Current < Strike = OTM
    expect(isITM(150, 150, 'C')).toBe(false) // ATM
  })

  it('should correctly identify ITM puts', () => {
    expect(isITM(150, 145, 'P')).toBe(true) // Current < Strike = ITM
    expect(isITM(150, 155, 'P')).toBe(false) // Current > Strike = OTM
    expect(isITM(150, 150, 'P')).toBe(false) // ATM
  })

  it('should handle invalid inputs', () => {
    expect(isITM('invalid' as any, 155, 'C')).toBe(false)
    expect(isITM(150, 'invalid' as any, 'C')).toBe(false)
    expect(isITM(150, 155, 'X' as any)).toBe(false)
  })
})

describe('isATM', () => {
  it('should identify ATM options within tolerance', () => {
    expect(isATM(150, 150, 0.005)).toBe(true) // Exact match
    expect(isATM(150, 150.50, 0.005)).toBe(true) // Within 0.5%
    expect(isATM(150, 149.50, 0.005)).toBe(true) // Within 0.5%
  })

  it('should identify OTM options outside tolerance', () => {
    expect(isATM(150, 155, 0.005)).toBe(false) // > 0.5%
    expect(isATM(150, 145, 0.005)).toBe(false) // > 0.5%
  })

  it('should handle custom tolerance', () => {
    expect(isATM(150, 153, 0.02)).toBe(true) // Within 2%
    expect(isATM(150, 154, 0.02)).toBe(false) // Outside 2%
  })
})

describe('getMoneyness', () => {
  it('should return correct moneyness for calls', () => {
    expect(getMoneyness(150, 155, 'C')).toBe('ITM')
    expect(getMoneyness(150, 150, 'C')).toBe('ATM')
    expect(getMoneyness(150, 145, 'C')).toBe('OTM')
  })

  it('should return correct moneyness for puts', () => {
    expect(getMoneyness(150, 145, 'P')).toBe('ITM')
    expect(getMoneyness(150, 150, 'P')).toBe('ATM')
    expect(getMoneyness(150, 155, 'P')).toBe('OTM')
  })
})

describe('calculateDTE', () => {
  it('should calculate days to expiration correctly', () => {
    const currentDate = new Date('2025-01-01')
    const expirationDate = new Date('2025-01-15')

    const dte = calculateDTE(expirationDate, currentDate)
    expect(dte).toBe(14)
  })

  it('should return 0 for past dates', () => {
    const currentDate = new Date('2025-01-15')
    const expirationDate = new Date('2025-01-01')

    const dte = calculateDTE(expirationDate, currentDate)
    expect(dte).toBe(0) // Never negative
  })

  it('should handle invalid dates', () => {
    expect(calculateDTE(new Date('invalid'))).toBe(0)
    expect(calculateDTE(null as any)).toBe(0)
  })

  it('should use current date by default', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const dte = calculateDTE(futureDate)
    expect(dte).toBeGreaterThanOrEqual(29)
    expect(dte).toBeLessThanOrEqual(30)
  })
})

describe('isValidOptionData', () => {
  it('should validate option data with required fields', () => {
    const validOption = {
      strike: 150,
      expDate: new Date(),
      optionType: 'C'
    }

    expect(isValidOptionData(validOption)).toBe(true)
  })

  it('should reject option data missing required fields', () => {
    expect(isValidOptionData({})).toBe(false)
    expect(isValidOptionData({ strike: 150 })).toBe(false)
    expect(isValidOptionData(null)).toBe(false)
    expect(isValidOptionData('invalid')).toBe(false)
  })
})
