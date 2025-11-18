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

export interface UnifiedOptionsChartProps {
  data: StockBar[]
  symbol: string
}

export function UnifiedOptionsChart({ data, symbol }: UnifiedOptionsChartProps) {
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

    // Generate strike prices (extend range for options)
    const strikeStep = Math.round(priceRange / 20) || 1
    const strikes: number[] = []
    const baseStrike = Math.floor(minPrice / strikeStep) * strikeStep
    for (let i = 0; i <= 25; i++) {
      strikes.push(baseStrike + (i * strikeStep))
    }

    // Generate future expiration dates (weekly for next 4 weeks)
    const lastDate = historical[historical.length - 1].date
    const expirations: Date[] = []
    for (let i = 1; i <= 4; i++) {
      const expDate = new Date(lastDate)
      expDate.setDate(lastDate.getDate() + (i * 7))
      expirations.push(expDate)
    }

    // Generate mock options prices
    const optionsGrid: MockOption[][] = expirations.map((expDate, expIdx) => {
      return strikes.map(strike => {
        const intrinsic = Math.max(0, currentPrice - strike)
        const timeValue = Math.random() * 5 * (1 - expIdx * 0.15) // Decay over time
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
      minPrice: strikes[0],
      maxPrice: strikes[strikes.length - 1]
    }
  }, [data])

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No data available
      </div>
    )
  }

  const { historical, strikes, expirations, optionsGrid, currentPrice, minPrice, maxPrice } = chartData

  // Chart dimensions
  const width = 1200
  const height = 600
  const marginLeft = 60
  const marginRight = 40
  const marginTop = 40
  const marginBottom = 80

  const chartWidth = width - marginLeft - marginRight
  const chartHeight = height - marginTop - marginBottom

  // Historical chart width (70%) and options grid width (30%)
  const historicalWidth = chartWidth * 0.7
  const optionsWidth = chartWidth * 0.3

  // Price scale
  const priceScale = (price: number): number => {
    return marginTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight
  }

  // Time scale for historical data
  const timeScale = (index: number, total: number): number => {
    return marginLeft + (index / (total - 1)) * historicalWidth
  }

  // Generate line path for historical prices
  const linePath = historical.map((point, idx) => {
    const x = timeScale(idx, historical.length)
    const y = priceScale(point.price)
    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  // Cell dimensions for options grid
  const cellWidth = optionsWidth / expirations.length
  const cellHeight = chartHeight / strikes.length

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">{symbol} - Unified Price & Options Visualization</h3>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="border border-gray-200 bg-white">
          {/* Y-axis grid lines and labels */}
          {strikes.map((strike, idx) => {
            const y = priceScale(strike)
            const isCurrentPrice = Math.abs(strike - currentPrice) < (maxPrice - minPrice) / 20
            return (
              <g key={`strike-${idx}`}>
                <line
                  x1={marginLeft}
                  y1={y}
                  x2={width - marginRight}
                  y2={y}
                  stroke={isCurrentPrice ? "#3b82f6" : "#e5e7eb"}
                  strokeWidth={isCurrentPrice ? 2 : 1}
                  strokeDasharray={isCurrentPrice ? "5,5" : "none"}
                />
                <text
                  x={marginLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill={isCurrentPrice ? "#3b82f6" : "#6b7280"}
                  fontWeight={isCurrentPrice ? "bold" : "normal"}
                >
                  ${strike.toFixed(0)}
                </text>
              </g>
            )
          })}

          {/* Historical price line */}
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
          />

          {/* Vertical divider between historical and options */}
          <line
            x1={marginLeft + historicalWidth}
            y1={marginTop}
            x2={marginLeft + historicalWidth}
            y2={height - marginBottom}
            stroke="#9ca3af"
            strokeWidth={2}
          />

          {/* Options grid cells */}
          {optionsGrid.map((column, colIdx) => {
            const x = marginLeft + historicalWidth + (colIdx * cellWidth)
            return column.map((cell, rowIdx) => {
              const y = priceScale(cell.strike) - cellHeight / 2
              const opacity = Math.min(parseFloat(cell.price) / 20, 0.8)

              return (
                <g key={`cell-${colIdx}-${rowIdx}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth - 1}
                    height={cellHeight}
                    fill={cell.isITM ? "#86efac" : "#fca5a5"}
                    opacity={opacity}
                    stroke="#fff"
                    strokeWidth={0.5}
                  />
                  <text
                    x={x + cellWidth / 2}
                    y={y + cellHeight / 2 + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#000"
                    fontWeight="500"
                  >
                    ${cell.price}
                  </text>
                </g>
              )
            })
          })}

          {/* X-axis labels for historical dates */}
          {historical.filter((_, idx) => idx % Math.floor(historical.length / 5) === 0).map((point, idx) => {
            const x = timeScale(historical.findIndex(h => h.date === point.date), historical.length)
            return (
              <text
                key={`hist-date-${idx}`}
                x={x}
                y={height - marginBottom + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
                transform={`rotate(-45, ${x}, ${height - marginBottom + 20})`}
              >
                {point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            )
          })}

          {/* X-axis labels for options expiration dates */}
          {expirations.map((expDate, idx) => {
            const x = marginLeft + historicalWidth + (idx * cellWidth) + cellWidth / 2
            return (
              <text
                key={`exp-date-${idx}`}
                x={x}
                y={height - marginBottom + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#3b82f6"
                fontWeight="600"
                transform={`rotate(-45, ${x}, ${height - marginBottom + 20})`}
              >
                {expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            )
          })}

          {/* Axis labels */}
          <text
            x={marginLeft + chartWidth / 2}
            y={height - 10}
            textAnchor="middle"
            fontSize="14"
            fill="#374151"
            fontWeight="600"
          >
            Time (Historical → Future Options Expirations)
          </text>

          <text
            x={-height / 2}
            y={20}
            textAnchor="middle"
            fontSize="14"
            fill="#374151"
            fontWeight="600"
            transform={`rotate(-90, 20, ${height / 2})`}
          >
            Price ($)
          </text>
        </svg>
      </div>

      <div className="mt-4 text-xs text-gray-600 space-y-1">
        <p>• <span className="font-semibold">Left side:</span> Historical price movement (line chart)</p>
        <p>• <span className="font-semibold">Right side:</span> Options call prices (cells) - Green = ITM, Red = OTM, Opacity = Price magnitude</p>
        <p>• <span className="font-semibold">Blue dashed line:</span> Current market price (~${currentPrice.toFixed(2)})</p>
        <p className="italic">Note: Options prices are simulated for visualization purposes</p>
      </div>
    </div>
  )
}
