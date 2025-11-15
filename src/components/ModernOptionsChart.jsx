import React, { useMemo } from 'react'

export function ModernOptionsChart({ data, symbol, optionsData = [], lastUpdated }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const currentPrice = data[data.length - 1].close

    const historical = data.map(bar => ({
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
      const optionsByExp = {}
      const allStrikes = new Set()
      const allExpirations = new Set()

      // First pass: collect ALL expirations and strikes
      Object.entries(optionsData).forEach(([contractSymbol, optData]) => {
        const match = contractSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/)
        if (!match) return

        const [, , dateStr, optionType, strikeStr] = match

        // Parse expiration date (YYMMDD)
        const year = 2000 + parseInt(dateStr.substring(0, 2))
        const month = parseInt(dateStr.substring(2, 4))
        const day = parseInt(dateStr.substring(4, 6))
        const expDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        // Always collect expiration dates, regardless of strike
        allExpirations.add(expDate)

        // Parse strike price (8 digits, last 3 are decimals)
        const strike = parseInt(strikeStr) / 1000
        allStrikes.add(strike)
      })

      // Second pass: populate options data for filtered strikes
      Object.entries(optionsData).forEach(([contractSymbol, optData]) => {
        const match = contractSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/)
        if (!match) return

        const [, , dateStr, optionType, strikeStr] = match

        const year = 2000 + parseInt(dateStr.substring(0, 2))
        const month = parseInt(dateStr.substring(2, 4))
        const day = parseInt(dateStr.substring(4, 6))
        const expDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        const strike = parseInt(strikeStr) / 1000
        const latestQuote = optData.latestQuote

        if (!latestQuote) return

        if (!optionsByExp[expDate]) {
          optionsByExp[expDate] = {}
        }

        optionsByExp[expDate][strike] = {
          strike,
          expDate: new Date(expDate),
          price: latestQuote.ap || latestQuote.bp || 0,
          isITM: strike < currentPrice
        }
      })

      // Get sorted unique expirations (show all available)
      const expirations = Array.from(allExpirations)
        .sort()
        .map(d => new Date(d))

      // Get sorted unique strikes - use ALL strikes without filtering
      const strikes = Array.from(allStrikes).sort((a, b) => a - b)

      // Extend price range to include all strikes
      if (strikes.length > 0) {
        extendedMin = Math.min(extendedMin, strikes[0])
        extendedMax = Math.max(extendedMax, strikes[strikes.length - 1])
      }

      // Build options grid aligned with strikes and expirations
      const optionsGrid = strikes.map(strike => {
        return expirations.map(expDate => {
          const expKey = expDate.toISOString().split('T')[0]
          const option = optionsByExp[expKey]?.[strike]

          if (option) {
            return option
          }

          // Return null if no data
          return null
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
  }, [data, optionsData])

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        No data available
      </div>
    )
  }

  const { historical, strikes, expirations, optionsGrid, currentPrice, minPrice, maxPrice, noOptionsData } = chartData

  // Chart dimensions - make width and height dynamic
  const marginLeft = 80
  const marginRight = 40
  const marginTop = 60
  const marginBottom = 100

  const minCellWidth = 80  // Minimum width per expiration column
  const calculatedOptionsWidth = Math.max(350, expirations.length * minCellWidth)
  const historicalWidthBase = 800  // Fixed width for historical section
  const width = marginLeft + historicalWidthBase + calculatedOptionsWidth + marginRight

  // Dynamic height based on number of strikes
  const minCellHeight = 25  // Minimum height per strike row
  const baseHeight = 600
  const calculatedHeight = Math.max(baseHeight, strikes.length * minCellHeight + 160)
  const height = calculatedHeight

  const chartWidth = width - marginLeft - marginRight
  const chartHeight = height - marginTop - marginBottom

  const historicalWidth = historicalWidthBase
  const optionsWidth = calculatedOptionsWidth

  const priceScale = (price) => {
    return marginTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight
  }

  // Sample historical data for rendering
  const sampledHistorical = historical.filter((_, idx) => idx % 2 === 0)

  const linePath = sampledHistorical.map((point, idx) => {
    const x = marginLeft + (historical.indexOf(point) / (historical.length - 1)) * historicalWidth
    const y = priceScale(point.price)
    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  const cellWidth = optionsWidth / expirations.length
  const cellHeight = Math.max(20, chartHeight / strikes.length) // Minimum 20px cell height

  return (
    <div className="relative bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
      {/* Header */}
      <div className="mb-8 flex items-baseline justify-between">
        <h2 className="text-5xl font-bold text-gray-900">
          {symbol}
        </h2>
        <div className="text-right">
          <div className="text-4xl font-bold text-gray-900">
            ${currentPrice.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500 uppercase tracking-wider">Current Price</div>
          {lastUpdated && (
            <div className="text-xs text-gray-400 mt-1">
              As of {new Date(lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height}>
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.1"/>
          </filter>
        </defs>

        {/* Grid lines */}
        {strikes.map((strike, idx) => {
          const y = priceScale(strike)
          const isCurrentPrice = Math.abs(strike - currentPrice) < (maxPrice - minPrice) / 20
          return (
            <g key={`grid-${idx}`}>
              <line
                x1={marginLeft}
                y1={y}
                x2={width - marginRight}
                y2={y}
                stroke={isCurrentPrice ? "#3b82f6" : "#e5e7eb"}
                strokeWidth={isCurrentPrice ? 2 : 1}
                strokeDasharray={isCurrentPrice ? "8,4" : "none"}
                opacity={isCurrentPrice ? 1 : 0.5}
              />
              <text
                x={marginLeft - 15}
                y={y + 5}
                textAnchor="end"
                fontSize="14"
                fontWeight={isCurrentPrice ? "700" : "500"}
                fill={isCurrentPrice ? "#3b82f6" : "#6b7280"}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                ${strike.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Price line */}
        <path
          d={linePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#shadow)"
        />

        {/* Divider */}
        <line
          x1={marginLeft + historicalWidth}
          y1={marginTop}
          x2={marginLeft + historicalWidth}
          y2={height - marginBottom}
          stroke="#d1d5db"
          strokeWidth={2}
          opacity="0.6"
        />

        {/* Options cells or message */}
        {noOptionsData ? (
          <text
            x={marginLeft + historicalWidth + optionsWidth / 2}
            y={height / 2}
            textAnchor="middle"
            fontSize="16"
            fill="#9ca3af"
            fontWeight="500"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            No options data available
          </text>
        ) : (
          optionsGrid.map((row, rowIdx) => {
          const strike = strikes[rowIdx]
          const y = priceScale(strike)

          return row.map((cell, colIdx) => {
            // Skip rendering if no data
            if (!cell) return null

            const x = marginLeft + historicalWidth + (colIdx * cellWidth)
            const value = parseFloat(cell.price)
            const maxValue = 40
            const intensity = Math.min(value / maxValue, 1)

            return (
              <g key={`cell-${rowIdx}-${colIdx}`}>
                <rect
                  x={x + 3}
                  y={y - cellHeight / 2 + 3}
                  width={cellWidth - 6}
                  height={cellHeight - 6}
                  fill={cell.isITM ? "#10b981" : "#ef4444"}
                  opacity={intensity * 0.2 + 0.05}
                  rx={6}
                />
                <text
                  x={x + cellWidth / 2}
                  y={y + 5}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill={cell.isITM ? "#059669" : "#dc2626"}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  ${typeof cell.price === 'number' ? cell.price.toFixed(2) : cell.price}
                </text>
              </g>
            )
          })
        }))}

        {/* X-axis labels - Historical */}
        {sampledHistorical.filter((_, idx) => idx % 8 === 0).map((point, idx) => {
          const x = marginLeft + (historical.indexOf(point) / (historical.length - 1)) * historicalWidth
          return (
            <text
              key={`hist-label-${idx}`}
              x={x}
              y={height - marginBottom + 30}
              textAnchor="middle"
              fontSize="13"
              fill="#6b7280"
              fontWeight="500"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          )
        })}

        {/* X-axis labels - Options */}
        {expirations.map((expDate, idx) => {
          const x = marginLeft + historicalWidth + (idx * cellWidth) + cellWidth / 2
          return (
            <text
              key={`exp-label-${idx}`}
              x={x}
              y={height - marginBottom + 30}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="#6b7280"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          )
        })}

        {/* Axis titles */}
        <text
          x={marginLeft + historicalWidth / 2}
          y={height - 50}
          textAnchor="middle"
          fontSize="14"
          fill="#9ca3af"
          fontWeight="500"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Historical Price
        </text>

        <text
          x={marginLeft + historicalWidth + optionsWidth / 2}
          y={height - 50}
          textAnchor="middle"
          fontSize="14"
          fill="#9ca3af"
          fontWeight="500"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Options Expirations
        </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-blue-500 rounded-full" />
          <span className="text-gray-700 font-medium">Historical Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-dashed rounded" />
          <span className="text-gray-700 font-medium">Current Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 bg-emerald-500 rounded opacity-30" />
          <span className="text-gray-700 font-medium">ITM Options</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 bg-red-500 rounded opacity-30" />
          <span className="text-gray-700 font-medium">OTM Options</span>
        </div>
      </div>
    </div>
  )
}
