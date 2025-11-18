import { useMemo } from 'react'
import { parseContractSymbol, isITM } from '../lib/optionsUtils'
import { formatISODate } from '../lib/formatters'
import { logger } from '../lib/logger'
import { StockBar, OptionsData } from '../types'

interface HistoricalDataPoint {
  date: Date
  price: number
}

interface OptionCell {
  strike: number
  expDate: Date
  contractSymbol: string
  optionType: 'C' | 'P'
  price: number
  bid: number
  ask: number
  bidSize: number
  askSize: number
  lastPrice: number
  volume: number
  impliedVolatility: number
  openInterest: number
  isITM: boolean
  delta: number
  gamma: number
  theta: number
  vega: number
  currentPrice: number
  pcRatioVolume?: number
  pcRatioOI?: number
}

interface ProcessedOptionsData {
  historical: HistoricalDataPoint[]
  strikes: number[]
  expirations: Date[]
  optionsGrid: (OptionCell | null)[][]
  currentPrice: number
  minPrice: number
  maxPrice: number
  noOptionsData?: boolean
}

/**
 * Custom hook to process and structure options chain data
 * Extracts business logic from ModernOptionsChart component
 */
export function useOptionsData(
  data: StockBar[],
  optionsData: OptionsData | null,
  optionType: 'call' | 'put'
): ProcessedOptionsData | null {
  return useMemo(() => {
    if (!data || data.length === 0) return null

    const currentPrice = data[data.length - 1].close

    const historical: HistoricalDataPoint[] = data.map(bar => ({
      date: new Date(bar.time),
      price: bar.close
    }))

    const prices = historical.map(h => h.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    let extendedMin = minPrice - priceRange * 0.15
    let extendedMax = maxPrice + priceRange * 0.15

    // Process real options data (API returns object with contract symbols as keys)
    if (optionsData && typeof optionsData === 'object' && Object.keys(optionsData).length > 0) {
      // Group options by expiration date and strike price
      const optionsByExp: Record<string, Record<number, { call?: OptionCell; put?: OptionCell }>> = {}
      const allStrikes = new Set<number>()
      const allExpirations = new Set<string>()

      // First pass: collect ALL expirations and strikes
      Object.entries(optionsData).forEach(([contractSymbol]) => {
        const parsed = parseContractSymbol(contractSymbol)
        if (!parsed) return

        const expDate = formatISODate(parsed.expirationDate)

        // Always collect expiration dates, regardless of strike
        allExpirations.add(expDate)

        // Collect strike prices
        allStrikes.add(parsed.strike)
      })

      // Second pass: populate options data and track puts/calls separately
      const putCallData: Record<string, { putVolume: number; callVolume: number; putOI: number; callOI: number }> = {}
      let putCount = 0
      let callCount = 0

      Object.entries(optionsData).forEach(([contractSymbol, optData]) => {
        const parsed = parseContractSymbol(contractSymbol)
        if (!parsed) return

        const { expirationDate, optionType, strike } = parsed
        const expDate = formatISODate(expirationDate)

        const latestQuote = optData.latestQuote
        const latestTrade = optData.latestTrade

        if (!latestQuote) return

        if (!optionsByExp[expDate]) {
          optionsByExp[expDate] = {}
        }

        // Track put/call data for ratio calculation
        const key = `${expDate}-${strike}`
        if (!putCallData[key]) {
          putCallData[key] = { putVolume: 0, callVolume: 0, putOI: 0, callOI: 0 }
        }

        const volume = latestTrade?.s || 0
        const oi = optData.openInterest || 0

        // Debug: Log first few entries to see what data we have
        if ((putCount + callCount) < 5) {
          logger.debug(`Sample option ${contractSymbol}:`, {
            type: optionType,
            volume,
            oi,
            latestTrade: latestTrade ? { p: latestTrade.p, s: latestTrade.s, t: latestTrade.t } : null
          })
        }

        if (optionType === 'P') {
          putCallData[key].putVolume = volume
          putCallData[key].putOI = oi
          putCount++
        } else if (optionType === 'C') {
          putCallData[key].callVolume = volume
          putCallData[key].callOI = oi
          callCount++
        }

        // Store both calls and puts separately
        if (!optionsByExp[expDate][strike]) {
          optionsByExp[expDate][strike] = {}
        }

        const optionKey = optionType === 'C' ? 'call' : 'put'
        const greeks = optData.greeks
        optionsByExp[expDate][strike][optionKey] = {
          strike,
          expDate: expirationDate,
          contractSymbol,
          optionType,
          price: latestQuote?.ap || latestQuote?.bp || 0,
          bid: latestQuote?.bp || 0,
          ask: latestQuote?.ap || 0,
          bidSize: latestQuote?.bs || 0,
          askSize: latestQuote?.as || 0,
          lastPrice: latestTrade?.p || 0,
          volume: latestTrade?.s || 0,
          impliedVolatility: optData.impliedVolatility || 0,
          openInterest: optData.openInterest || 0,
          isITM: isITM(strike, currentPrice, optionType),
          // Greeks from API
          delta: greeks?.delta || 0,
          gamma: greeks?.gamma || 0,
          theta: greeks?.theta || 0,
          vega: greeks?.vega || 0,
          currentPrice // Add current price for calculations
        }
      })

      logger.debug(`Options data summary: ${putCount} puts, ${callCount} calls`)

      // Calculate P/C ratios and add to options data
      let debugCount = 0
      let totalEntries = 0
      let entriesWithData = 0
      let entriesWithBothPutAndCall = 0

      // First, let's log a sample of putCallData to understand the structure
      const sampleKeys = Object.keys(putCallData).slice(0, 3)
      logger.debug('Sample putCallData entries:', sampleKeys.map(k => ({
        key: k,
        data: putCallData[k]
      })))

      Object.entries(putCallData).forEach(([key, data]) => {
        // Key format is "YYYY-MM-DD-strike", so split on last hyphen
        const lastHyphenIndex = key.lastIndexOf('-')
        const expDateStr = key.substring(0, lastHyphenIndex)
        const strikeStr = key.substring(lastHyphenIndex + 1)
        const strike = parseFloat(strikeStr)
        totalEntries++

        const hasPutData = data.putVolume > 0 || data.putOI > 0
        const hasCallData = data.callVolume > 0 || data.callOI > 0

        if (hasPutData || hasCallData) {
          entriesWithData++
        }

        if (hasPutData && hasCallData) {
          entriesWithBothPutAndCall++

          // Log first 10 entries that have BOTH put and call data
          if (debugCount < 10) {
            logger.debug(`P/C Data for ${key}:`, {
              putVolume: data.putVolume,
              callVolume: data.callVolume,
              putOI: data.putOI,
              callOI: data.callOI
            })
            debugCount++
          }
        }

        if (optionsByExp[expDateStr]?.[strike]) {
          // Calculate P/C ratio based on volume (put volume / call volume)
          const pcRatioVolume = data.callVolume > 0
            ? data.putVolume / data.callVolume
            : (data.putVolume > 0 ? 2 : 0) // If only puts exist, show high ratio

          // Calculate P/C ratio based on open interest
          const pcRatioOI = data.callOI > 0
            ? data.putOI / data.callOI
            : (data.putOI > 0 ? 2 : 0)

          // Add P/C ratios to both call and put if they exist
          if (optionsByExp[expDateStr][strike].call) {
            optionsByExp[expDateStr][strike].call!.pcRatioVolume = pcRatioVolume
            optionsByExp[expDateStr][strike].call!.pcRatioOI = pcRatioOI
          }
          if (optionsByExp[expDateStr][strike].put) {
            optionsByExp[expDateStr][strike].put!.pcRatioVolume = pcRatioVolume
            optionsByExp[expDateStr][strike].put!.pcRatioOI = pcRatioOI
          }
        }
      })

      logger.debug(`P/C Summary: ${entriesWithData} of ${totalEntries} strike/exp combinations have data`)
      logger.debug(`  - ${entriesWithBothPutAndCall} have BOTH put and call data`)

      // Get sorted unique expirations (show all available)
      const expirations = Array.from(allExpirations)
        .sort()
        .map(d => new Date(d))

      // Get sorted unique strikes - use ALL strikes without filtering
      // Sort descending so high prices are at the top
      let strikes = Array.from(allStrikes).sort((a, b) => b - a)

      // Filter out strikes where all contracts across all expirations have zero bid/ask
      // This trims the chart vertically to show only actionable price ranges
      strikes = strikes.filter(strike => {
        // Check if ANY expiration for this strike has non-zero bid/ask
        return Array.from(allExpirations).some(expDate => {
          const optionData = optionsByExp[expDate]?.[strike]
          if (!optionData) return false

          // Check both call and put for non-zero bid/ask
          const callData = optionData.call
          const putData = optionData.put

          const callHasValue = callData && (callData.bid > 0 || callData.ask > 0)
          const putHasValue = putData && (putData.bid > 0 || putData.ask > 0)

          return callHasValue || putHasValue
        })
      })

      // Set price range to exactly match strike range so chart aligns properly
      // strikes are sorted descending, so strikes[0] is highest, strikes[last] is lowest
      if (strikes.length > 0) {
        extendedMin = strikes[strikes.length - 1]  // lowest strike
        extendedMax = strikes[0]  // highest strike
      }

      // Build options grid aligned with strikes and expirations
      // Filter by selected option type (call or put)
      const optionsGrid: (OptionCell | null)[][] = strikes.map(strike => {
        return expirations.map(expDate => {
          const expKey = formatISODate(expDate)
          const optionData = optionsByExp[expKey]?.[strike]

          // Extract the selected option type (call or put)
          if (optionData) {
            const option = optionData[optionType]
            if (option) {
              return option
            }
          }

          // Return null if no data
          return null
        })
      })

      // Debug: Log first few cells with P/C ratio data
      let cellsWithPC = 0
      for (let i = 0; i < Math.min(5, optionsGrid.length); i++) {
        for (let j = 0; j < Math.min(5, optionsGrid[i].length); j++) {
          const cell = optionsGrid[i][j]
          if (cell && cell.pcRatioVolume !== undefined) {
            logger.debug(`Cell [${i},${j}] strike=${strikes[i]} has pcRatioVolume:`, cell.pcRatioVolume)
            cellsWithPC++
            if (cellsWithPC >= 5) break
          }
        }
        if (cellsWithPC >= 5) break
      }
      logger.debug(`Total cells with pcRatioVolume in grid:`, optionsGrid.flat().filter(c => c && c.pcRatioVolume !== undefined).length)

      return {
        historical,
        strikes,
        expirations,
        optionsGrid,
        currentPrice,
        minPrice: extendedMin,
        maxPrice: extendedMax
      }
    }

    // No options data available - return null to show message
    return {
      historical,
      strikes: [],
      expirations: [],
      optionsGrid: [],
      currentPrice,
      minPrice: extendedMin,
      maxPrice: extendedMax,
      noOptionsData: true
    }
  }, [data, optionsData, optionType])
}
