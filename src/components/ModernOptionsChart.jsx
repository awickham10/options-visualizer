import React, { useMemo, useState } from 'react'

export function ModernOptionsChart({ data, symbol, optionsData = [], lastUpdated }) {
  const [selectedExpirations, setSelectedExpirations] = useState(new Set())
  const [selectedStrikes, setSelectedStrikes] = useState(new Set())

  const handleExpirationClick = (expDate) => {
    setSelectedExpirations(prev => {
      const newSet = new Set(prev)
      const dateKey = expDate.toISOString()
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey)
      } else {
        newSet.add(dateKey)
      }
      return newSet
    })
  }

  const handleStrikeClick = (strike) => {
    setSelectedStrikes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(strike)) {
        newSet.delete(strike)
      } else {
        newSet.add(strike)
      }
      return newSet
    })
  }
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
    <div className="relative bg-white p-12" style={{ border: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="mb-12 flex items-baseline justify-between pb-8" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="text-7xl font-light tracking-[-0.03em]" style={{
          color: 'var(--color-text-primary)',
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 200
        }}>
          {symbol}
        </h2>
        <div className="text-right">
          <div className="text-5xl font-light tracking-[-0.02em] mb-1" style={{
            color: 'var(--color-text-primary)',
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 300
          }}>
            ${currentPrice.toFixed(2)}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
            Current
          </div>
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
          const isSelected = selectedStrikes.has(strike)
          return (
            <g key={`grid-${idx}`}>
              <line
                x1={marginLeft}
                y1={y}
                x2={width - marginRight}
                y2={y}
                stroke={isSelected ? "#0047FF" : "#E8E8E8"}
                strokeWidth={isSelected ? 1 : 0.5}
                opacity={isSelected ? 0.4 : 0.3}
              />
              <text
                x={marginLeft - 15}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fontWeight={isSelected ? "600" : "400"}
                fill={isSelected ? "#0047FF" : "#A3A3A3"}
                fontFamily="DM Sans, sans-serif"
                letterSpacing="0.02em"
                style={{ cursor: 'pointer' }}
                onClick={() => handleStrikeClick(strike)}
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
          stroke="#0A0A0A"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current price line */}
        <line
          x1={marginLeft}
          y1={priceScale(currentPrice)}
          x2={width - marginRight}
          y2={priceScale(currentPrice)}
          stroke="#0047FF"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={1}
        />

        {/* Current price label */}
        <text
          x={marginLeft - 15}
          y={priceScale(currentPrice) + 4}
          textAnchor="end"
          fontSize="11"
          fontWeight="500"
          fill="#0047FF"
          fontFamily="DM Sans, sans-serif"
          letterSpacing="0.02em"
        >
          ${currentPrice.toFixed(2)}
        </text>

        {/* Divider */}
        <line
          x1={marginLeft + historicalWidth}
          y1={marginTop}
          x2={marginLeft + historicalWidth}
          y2={height - marginBottom}
          stroke="#E8E8E8"
          strokeWidth={1}
          opacity="0.5"
        />

        {/* Options cells or message */}
        {noOptionsData ? (
          <text
            x={marginLeft + historicalWidth + optionsWidth / 2}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#A3A3A3"
            fontWeight="400"
            fontFamily="DM Sans, sans-serif"
            letterSpacing="0.05em"
          >
            NO OPTIONS DATA
          </text>
        ) : (
          optionsGrid.map((row, rowIdx) => {
          const strike = strikes[rowIdx]
          const y = priceScale(strike)
          const isStrikeSelected = selectedStrikes.has(strike)

          return row.map((cell, colIdx) => {
            // Skip rendering if no data
            if (!cell) return null

            const x = marginLeft + historicalWidth + (colIdx * cellWidth)
            const value = parseFloat(cell.price)
            const maxValue = 40
            const intensity = Math.min(value / maxValue, 1)

            const expDate = expirations[colIdx]
            const isExpSelected = selectedExpirations.has(expDate.toISOString())
            const isHighlighted = isStrikeSelected || isExpSelected

            return (
              <g key={`cell-${rowIdx}-${colIdx}`}>
                <rect
                  x={x + 2}
                  y={y - cellHeight / 2 + 2}
                  width={cellWidth - 4}
                  height={cellHeight - 4}
                  fill={isHighlighted ? "#0047FF" : "#0A0A0A"}
                  opacity={isHighlighted ? 0.15 : (intensity * 0.12 + 0.02)}
                  rx={0}
                />
                <text
                  x={x + cellWidth / 2}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHighlighted ? "600" : "500"}
                  fill={isHighlighted ? "#0047FF" : "#0A0A0A"}
                  fontFamily="DM Sans, sans-serif"
                  letterSpacing="0.01em"
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
              fontSize="10"
              fill="#A3A3A3"
              fontWeight="400"
              fontFamily="DM Sans, sans-serif"
              letterSpacing="0.05em"
            >
              {point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </text>
          )
        })}

        {/* X-axis labels - Options */}
        {expirations.map((expDate, idx) => {
          const x = marginLeft + historicalWidth + (idx * cellWidth) + cellWidth / 2
          const isSelected = selectedExpirations.has(expDate.toISOString())
          return (
            <text
              key={`exp-label-${idx}`}
              x={x}
              y={height - marginBottom + 30}
              textAnchor="middle"
              fontSize="10"
              fontWeight={isSelected ? "700" : "500"}
              fill={isSelected ? "#0047FF" : "#6B6B6B"}
              fontFamily="DM Sans, sans-serif"
              letterSpacing="0.05em"
              style={{ cursor: 'pointer' }}
              onClick={() => handleExpirationClick(expDate)}
            >
              {expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </text>
          )
        })}

        {/* Axis titles */}
        <text
          x={marginLeft + historicalWidth / 2}
          y={height - 50}
          textAnchor="middle"
          fontSize="9"
          fill="#A3A3A3"
          fontWeight="500"
          fontFamily="DM Sans, sans-serif"
          letterSpacing="0.15em"
        >
          HISTORICAL
        </text>

        <text
          x={marginLeft + historicalWidth + optionsWidth / 2}
          y={height - 50}
          textAnchor="middle"
          fontSize="9"
          fill="#A3A3A3"
          fontWeight="500"
          fontFamily="DM Sans, sans-serif"
          letterSpacing="0.15em"
        >
          EXPIRATIONS
        </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-12 pt-8 flex items-center justify-end gap-8" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-px" style={{ background: 'var(--color-text-primary)' }} />
          <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Price
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-px" style={{ background: 'var(--color-accent)', borderTop: '1px dashed var(--color-accent)' }} />
          <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Current
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-3" style={{ background: 'var(--color-text-primary)', opacity: 0.08 }} />
          <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Intensity
          </span>
        </div>
      </div>
    </div>
  )
}
