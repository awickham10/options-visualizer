import { useMemo } from 'react'
import { StockBar } from '../types'

interface HistoricalPoint {
  date: Date
  price: number
}

interface MockOption {
  strike: number
  expDate: Date
  price: string
  isITM: boolean
}

interface ChartData {
  historical: HistoricalPoint[]
  strikes: number[]
  expirations: Date[]
  optionsGrid: MockOption[][]
  currentPrice: number
  minPrice: number
  maxPrice: number
}

interface ChartLine {
  line: string
  strikeIdx: number
  isCurrentPriceLine: boolean
  strike: number
  row: number
}

export interface TerminalOptionsChartProps {
  data: StockBar[]
  symbol: string
}

export function TerminalOptionsChart({ data, symbol }: TerminalOptionsChartProps) {
  const chartData = useMemo((): ChartData | null => {
    if (!data || data.length === 0) return null

    const currentPrice = data[data.length - 1].close

    // Get historical prices
    const historical: HistoricalPoint[] = data.map(bar => ({
      date: new Date(bar.time),
      price: bar.close
    }))

    // Calculate price range
    const prices = historical.map(h => h.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    // Extend range for options
    const extendedMin = minPrice - priceRange * 0.1
    const extendedMax = maxPrice + priceRange * 0.1

    // Generate strike prices (price levels for Y-axis)
    const numStrikes = 20
    const strikeStep = (extendedMax - extendedMin) / numStrikes
    const strikes: number[] = []
    for (let i = 0; i <= numStrikes; i++) {
      strikes.push(extendedMin + (i * strikeStep))
    }

    // Generate future expiration dates (4 weeks)
    const lastDate = historical[historical.length - 1].date
    const expirations: Date[] = []
    for (let i = 1; i <= 4; i++) {
      const expDate = new Date(lastDate)
      expDate.setDate(lastDate.getDate() + (i * 7))
      expirations.push(expDate)
    }

    // Generate mock options prices for each strike and expiration
    const optionsGrid: MockOption[][] = strikes.map(strike => {
      return expirations.map((expDate, expIdx) => {
        const intrinsic = Math.max(0, currentPrice - strike)
        const timeValue = Math.random() * 5 * (1 - expIdx * 0.15)
        const price = intrinsic + timeValue
        return {
          strike,
          expDate,
          price: price.toFixed(2),
          isITM: strike < currentPrice
        }
      })
    })

    return {
      historical,
      strikes,
      expirations,
      optionsGrid,
      currentPrice,
      minPrice: extendedMin,
      maxPrice: extendedMax
    }
  }, [data])

  if (!chartData) {
    return (
      <div className="bg-black p-8 rounded-lg border-2 border-green-500 font-mono text-green-400">
        <div className="text-center">
          NO DATA LOADED
        </div>
      </div>
    )
  }

  const { historical, strikes, expirations, optionsGrid, currentPrice, minPrice, maxPrice } = chartData

  // Sample historical data for display
  const historicalWidth = 50 // characters
  const sampledHistorical: HistoricalPoint[] = []
  for (let i = 0; i < historicalWidth; i++) {
    const idx = Math.floor((i / historicalWidth) * historical.length)
    if (idx < historical.length) {
      sampledHistorical.push(historical[idx])
    }
  }

  const getPriceRow = (price: number): number => {
    const normalized = (price - minPrice) / (maxPrice - minPrice)
    const row = strikes.length - 1 - Math.round(normalized * (strikes.length - 1))
    return Math.max(0, Math.min(strikes.length - 1, row))
  }

  // Build the chart
  const buildChart = (): ChartLine[] => {
    const lines: ChartLine[] = []

    strikes.forEach((strike, strikeIdx) => {
      const row = strikes.length - 1 - strikeIdx
      let line = ''

      // Price label
      const priceLabel = `$${strike.toFixed(0)}`.padStart(5, ' ')
      line += priceLabel + ' '

      // Historical chart section
      let historicalChars = ''
      sampledHistorical.forEach((point, idx) => {
        const pointRow = getPriceRow(point.price)
        if (pointRow === row) {
          historicalChars += '█'
        } else if (idx > 0) {
          const prevRow = getPriceRow(sampledHistorical[idx - 1].price)
          // Draw connecting line between points
          if ((pointRow < row && prevRow >= row) || (pointRow >= row && prevRow < row)) {
            historicalChars += '│'
          } else if (Math.abs(pointRow - row) === 1 && Math.abs(prevRow - row) === 1) {
            historicalChars += '·'
          } else {
            historicalChars += ' '
          }
        } else {
          historicalChars += ' '
        }
      })

      line += historicalChars

      // Divider
      const isCurrentPriceLine = Math.abs(strike - currentPrice) < (maxPrice - minPrice) / (strikes.length * 1.5)
      line += isCurrentPriceLine ? '┼─' : '├─'

      // Options grid section (each column is an expiration date)
      const optionRow = optionsGrid[row]
      if (optionRow) {
        optionRow.forEach(option => {
          const cellValue = option.price.padStart(6, ' ')
          line += cellValue + ' '
        })
      }

      lines.push({
        line,
        strikeIdx,
        isCurrentPriceLine,
        strike,
        row
      })
    })

    return lines
  }

  const chartLines = buildChart()

  return (
    <div className="bg-black p-6 rounded-lg border-2 border-green-500 shadow-2xl shadow-green-500/20">
      {/* Terminal Header */}
      <div className="font-mono text-green-400 mb-4 pb-3 border-b border-green-500/30">
        <div className="text-center mb-2">
          <span className="text-green-300 text-sm">╔════════════════════════════════════════════════════════════╗</span>
        </div>
        <div className="text-center">
          <span className="text-green-400 font-bold tracking-wider text-lg">
            OPTIONS TERMINAL v2.5 :: {symbol}
          </span>
        </div>
        <div className="text-center mt-2">
          <span className="text-green-300 text-sm">╚════════════════════════════════════════════════════════════╝</span>
        </div>
        <div className="mt-3 text-xs text-green-500 text-center">
          CURRENT: ${currentPrice.toFixed(2)} | RANGE: ${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="font-mono text-xs text-green-600 mb-1 ml-16">
        <span className="inline-block" style={{width: '50ch'}}>
          ← HISTORICAL PRICE
        </span>
        <span className="inline-block ml-2">
          OPTIONS (FUTURE EXPIRATIONS) →
        </span>
      </div>
      <div className="font-mono text-xs text-green-700 mb-2 ml-16">
        <span className="inline-block" style={{width: '50ch'}}></span>
        <span className="inline-block ml-2">
          {expirations.map((exp, idx) => (
            <span key={idx} className="inline-block" style={{width: '7ch', textAlign: 'center'}}>
              {exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          ))}
        </span>
      </div>

      {/* Chart */}
      <div className="font-mono text-xs leading-tight overflow-x-auto">
        {chartLines.map((item, idx) => {
          const { line, isCurrentPriceLine, row } = item

          const baseClass = isCurrentPriceLine ? 'text-cyan-400 font-bold' : 'text-green-400'

          // Parse the line to color different sections
          const parts = line.split(/([┼├]─)/)
          const priceAndHistorical = parts[0]
          const divider = parts[1]
          const optionsSection = parts[2] || ''

          return (
            <div key={idx} className={baseClass}>
              <span>{priceAndHistorical}</span>
              <span className={isCurrentPriceLine ? 'text-cyan-400' : 'text-green-600'}>{divider}</span>
              {optionsSection.trim() && (
                <span>
                  {optionsSection.match(/.{1,7}/g)?.map((cell, cellIdx) => {
                    const optionData = optionsGrid[row]?.[cellIdx]
                    const hasValue = cell.trim().length > 0 && !isNaN(parseFloat(cell.trim()))
                    const isITM = optionData?.isITM

                    return (
                      <span
                        key={cellIdx}
                        className={hasValue ? (isITM ? 'text-emerald-300' : 'text-red-400') : ''}
                      >
                        {cell}
                      </span>
                    )
                  })}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-green-500/30 font-mono text-xs">
        <div className="grid grid-cols-2 gap-3 text-green-500">
          <div className="flex items-center gap-2">
            <span className="text-green-400">█│·</span>
            <span>Historical Price Chart</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400">┼─</span>
            <span>Current Price Level (${currentPrice.toFixed(2)})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-300">XX.XX</span>
            <span>In-The-Money Options (ITM)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400">XX.XX</span>
            <span>Out-The-Money Options (OTM)</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 font-mono text-xs text-green-700 text-center">
        &gt; TIME_AXIS: [PAST ←────────────┼────────────→ FUTURE] | STATUS: ACTIVE
      </div>
    </div>
  )
}
