import React, { useMemo, useState, useRef } from 'react'
import { HeatmapToggle } from './HeatmapToggle'
import { CallPutToggle } from './CallPutToggle'

export function ModernOptionsChart({ data, symbol, optionsData = [], lastUpdated, onCellSelect, costBasis, onCostBasisChange }) {
  const [selectedExpirations, setSelectedExpirations] = useState(new Set())
  const [selectedStrikes, setSelectedStrikes] = useState(new Set())
  const [heatmapMode, setHeatmapMode] = useState('volume')
  const [optionType, setOptionType] = useState('call')
  const [isEditingCostBasis, setIsEditingCostBasis] = useState(false)
  const [tempCostBasis, setTempCostBasis] = useState('')
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  const svgRef = useRef(null)

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

  const handleCellClick = (cell) => {
    if (onCellSelect) {
      onCellSelect(cell)
    }
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

      // Second pass: populate options data and track puts/calls separately
      const putCallData = {} // Track puts and calls separately for P/C ratio
      let putCount = 0
      let callCount = 0

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
          console.log(`Sample option ${contractSymbol}:`, {
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
        optionsByExp[expDate][strike][optionKey] = {
          strike,
          expDate: new Date(expDate),
          contractSymbol,
          optionType,
          price: latestQuote.ap || latestQuote.bp || 0,
          bid: latestQuote.bp || 0,
          ask: latestQuote.ap || 0,
          bidSize: latestQuote.bs || 0,
          askSize: latestQuote.as || 0,
          lastPrice: latestTrade?.p || 0,
          volume: latestTrade?.s || 0,
          impliedVolatility: optData.greeks?.implied_volatility || 0,
          openInterest: optData.openInterest || 0,
          isITM: optionType === 'C' ? strike < currentPrice : strike > currentPrice,
          // Add all greeks for covered call analysis
          delta: optData.greeks?.delta || 0,
          gamma: optData.greeks?.gamma || 0,
          theta: optData.greeks?.theta || 0,
          vega: optData.greeks?.vega || 0,
          currentPrice // Add current price for calculations
        }
      })

      console.log(`Options data summary: ${putCount} puts, ${callCount} calls`)

      // Calculate P/C ratios and add to options data
      let debugCount = 0
      let totalEntries = 0
      let entriesWithData = 0
      let entriesWithBothPutAndCall = 0

      // First, let's log a sample of putCallData to understand the structure
      const sampleKeys = Object.keys(putCallData).slice(0, 3)
      console.log('Sample putCallData entries:', sampleKeys.map(k => ({
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
            console.log(`P/C Data for ${key}:`, {
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
            optionsByExp[expDateStr][strike].call.pcRatioVolume = pcRatioVolume
            optionsByExp[expDateStr][strike].call.pcRatioOI = pcRatioOI
          }
          if (optionsByExp[expDateStr][strike].put) {
            optionsByExp[expDateStr][strike].put.pcRatioVolume = pcRatioVolume
            optionsByExp[expDateStr][strike].put.pcRatioOI = pcRatioOI
          }
        }
      })

      console.log(`P/C Summary: ${entriesWithData} of ${totalEntries} strike/exp combinations have data`)
      console.log(`  - ${entriesWithBothPutAndCall} have BOTH put and call data`)

      // Get sorted unique expirations (show all available)
      const expirations = Array.from(allExpirations)
        .sort()
        .map(d => new Date(d))

      // Get sorted unique strikes - use ALL strikes without filtering
      // Sort descending so high prices are at the top
      const strikes = Array.from(allStrikes).sort((a, b) => b - a)

      // Set price range to exactly match strike range so chart aligns properly
      // strikes are sorted descending, so strikes[0] is highest, strikes[last] is lowest
      if (strikes.length > 0) {
        extendedMin = strikes[strikes.length - 1]  // lowest strike
        extendedMax = strikes[0]  // highest strike
      }

      // Build options grid aligned with strikes and expirations
      // Filter by selected option type (call or put)
      const optionsGrid = strikes.map(strike => {
        return expirations.map(expDate => {
          const expKey = expDate.toISOString().split('T')[0]
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
            console.log(`Cell [${i},${j}] strike=${strikes[i]} has pcRatioVolume:`, cell.pcRatioVolume)
            cellsWithPC++
            if (cellsWithPC >= 5) break
          }
        }
        if (cellsWithPC >= 5) break
      }
      console.log(`Total cells with pcRatioVolume in grid:`, optionsGrid.flat().filter(c => c && c.pcRatioVolume !== undefined).length)

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

  // Fixed cell height for options grid
  const FIXED_CELL_HEIGHT = 30  // Fixed 30px per strike row
  const CHART_HEIGHT = strikes.length * FIXED_CELL_HEIGHT  // Total height based on number of strikes
  const height = CHART_HEIGHT + marginTop + marginBottom

  const chartWidth = width - marginLeft - marginRight
  const chartHeight = height - marginTop - marginBottom

  const historicalWidth = historicalWidthBase
  const optionsWidth = calculatedOptionsWidth

  // Convert price to row-based Y position with interpolation for accurate alignment
  // This is THE SINGLE SOURCE OF TRUTH for all price-to-Y conversions
  const priceToRowY = (price) => {
    if (strikes.length === 0) return marginTop

    // Strikes are sorted descending (highest to lowest)
    // Find the two strikes that bound this price
    let upperIdx = -1
    let lowerIdx = -1

    for (let i = 0; i < strikes.length; i++) {
      if (strikes[i] >= price) {
        upperIdx = i
      } else {
        lowerIdx = i
        break
      }
    }

    // Handle edge cases
    if (upperIdx === -1) {
      // Price is above all strikes
      return marginTop + (FIXED_CELL_HEIGHT / 2)
    }
    if (lowerIdx === -1) {
      // Price is below all strikes
      return marginTop + ((strikes.length - 1) * FIXED_CELL_HEIGHT) + (FIXED_CELL_HEIGHT / 2)
    }

    // Interpolate between the two strikes
    const upperStrike = strikes[upperIdx]
    const lowerStrike = strikes[lowerIdx]
    const ratio = (upperStrike - price) / (upperStrike - lowerStrike)

    const upperY = marginTop + (upperIdx * FIXED_CELL_HEIGHT) + (FIXED_CELL_HEIGHT / 2)
    const lowerY = marginTop + (lowerIdx * FIXED_CELL_HEIGHT) + (FIXED_CELL_HEIGHT / 2)

    return upperY + ratio * (lowerY - upperY)
  }

  // Sample historical data for rendering
  const sampledHistorical = historical.filter((_, idx) => idx % 2 === 0)

  // Create full path data for the line chart
  const linePathData = sampledHistorical.map((point, idx) => {
    const x = marginLeft + (historical.indexOf(point) / (historical.length - 1)) * historicalWidth
    const y = priceToRowY(point.price)
    return { x, y, ...point }
  })

  const linePath = linePathData.map((point, idx) => {
    return `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  }).join(' ')

  // Create area path for gradient fill
  const areaPath = linePathData.length > 0
    ? linePath +
      ` L ${linePathData[linePathData.length - 1].x} ${height - marginBottom}` +
      ` L ${linePathData[0].x} ${height - marginBottom} Z`
    : ''

  const cellWidth = optionsWidth / expirations.length
  const cellHeight = FIXED_CELL_HEIGHT // Fixed height for all cells

  // Volume bar chart data
  const volumeHeight = 60 // Height of volume chart area
  const maxVolume = Math.max(...historical.map(h => h.volume || 0), 1)
  const volumeY = height - marginBottom + 10 // Position below the main chart

  // Helper function to calculate percentile
  const percentile = (arr, p) => {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const index = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (lower === upper) return sorted[lower]
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  // Calculate intensity based on heatmap mode with outlier handling
  const calculateIntensity = (cell) => {
    if (!cell) return 0

    let value = 0
    let minValue = 0
    let maxValue = 1

    const validCells = optionsGrid.flat().filter(c => c)

    switch (heatmapMode) {
      case 'volume':
        value = cell.volume || 0
        const volumes = validCells.map(c => c.volume || 0)
        minValue = percentile(volumes, 5)  // 5th percentile
        maxValue = percentile(volumes, 95) || 1  // 95th percentile
        break
      case 'iv':
        value = cell.impliedVolatility || 0
        const ivs = validCells.map(c => c.impliedVolatility || 0)
        minValue = percentile(ivs, 5)
        maxValue = percentile(ivs, 95) || 0.01
        break
      case 'oi':
        value = cell.openInterest || 0
        const ois = validCells.map(c => c.openInterest || 0)
        minValue = percentile(ois, 5)
        maxValue = percentile(ois, 95) || 1
        break
      case 'pc':
        value = cell.pcRatioVolume || 0
        const pcRatios = validCells.map(c => c.pcRatioVolume || 0)
        minValue = percentile(pcRatios, 5)
        maxValue = percentile(pcRatios, 95) || 0.01
        break
      default:
        value = cell.volume || 0
        const defaultVolumes = validCells.map(c => c.volume || 0)
        minValue = percentile(defaultVolumes, 5)
        maxValue = percentile(defaultVolumes, 95) || 1
    }

    // Normalize to 0-1 range based on percentiles (clamp outliers)
    if (maxValue === minValue) return 0
    const intensity = (value - minValue) / (maxValue - minValue)
    return Math.max(0, Math.min(intensity, 1))  // Clamp to [0, 1]
  }

  return (
    <div className="relative">
      <div className="bg-white p-12" style={{ border: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="mb-12 pb-8" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-baseline justify-between mb-8">
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
            <div className="text-[10px] uppercase tracking-[0.2em] font-medium mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
              Current
            </div>

            {/* Cost Basis Input */}
            <div className="flex items-baseline justify-end gap-2 mt-4">
              <span className="text-[9px] uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                Cost Basis
              </span>
              {!isEditingCostBasis ? (
                <button
                  onClick={() => {
                    setIsEditingCostBasis(true)
                    setTempCostBasis(costBasis?.toFixed(2) || currentPrice.toFixed(2))
                  }}
                  className="group relative"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="text-lg font-medium tracking-tight transition-all group-hover:opacity-60" style={{
                    color: 'var(--color-text-primary)',
                    fontFamily: 'DM Mono, monospace'
                  }}>
                    ${(costBasis || currentPrice).toFixed(2)}
                  </div>
                  <div className="absolute -bottom-1 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{
                    background: 'var(--color-border)'
                  }} />
                </button>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  value={tempCostBasis}
                  onChange={(e) => setTempCostBasis(e.target.value)}
                  onBlur={() => {
                    const newBasis = parseFloat(tempCostBasis)
                    if (!isNaN(newBasis) && newBasis > 0) {
                      onCostBasisChange(newBasis)
                    }
                    setIsEditingCostBasis(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newBasis = parseFloat(tempCostBasis)
                      if (!isNaN(newBasis) && newBasis > 0) {
                        onCostBasisChange(newBasis)
                      }
                      setIsEditingCostBasis(false)
                    } else if (e.key === 'Escape') {
                      setIsEditingCostBasis(false)
                    }
                  }}
                  autoFocus
                  className="text-lg font-medium tracking-tight px-2 py-1"
                  style={{
                    width: '120px',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'DM Mono, monospace',
                    border: '1px solid var(--color-accent)',
                    background: 'transparent',
                    outline: 'none'
                  }}
                />
              )}
            </div>

            {/* Unrealized P/L Display */}
            {costBasis && costBasis !== currentPrice && (
              <div className="mt-2 flex items-center justify-end gap-2">
                <div className="text-[9px] uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                  Position
                </div>
                <div className="text-sm font-semibold" style={{
                  color: currentPrice > costBasis ? '#10b981' : currentPrice < costBasis ? '#ef4444' : 'var(--color-text-secondary)',
                  fontFamily: 'DM Mono, monospace'
                }}>
                  {currentPrice > costBasis ? '+' : ''}{(((currentPrice - costBasis) / costBasis) * 100).toFixed(2)}%
                </div>
                <div className="text-[10px]" style={{
                  color: currentPrice > costBasis ? '#10b981' : currentPrice < costBasis ? '#ef4444' : 'var(--color-text-secondary)',
                  fontFamily: 'DM Mono, monospace'
                }}>
                  (${currentPrice > costBasis ? '+' : ''}{(currentPrice - costBasis).toFixed(2)})
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
              Option Type
            </span>
            <CallPutToggle optionType={optionType} onTypeChange={setOptionType} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
              Heatmap
            </span>
            <HeatmapToggle mode={heatmapMode} onModeChange={setHeatmapMode} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full overflow-x-auto overflow-y-visible" style={{ paddingBottom: '16px' }}>
        <svg ref={svgRef} width={width} height={height}>
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.1"/>
          </filter>
          <linearGradient id="priceGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0A0A0A" stopOpacity="0.1"/>
            <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {(() => {
          const minLabelSpacing = 25 // Minimum pixels between labels
          const maxLabels = Math.floor(chartHeight / minLabelSpacing)
          const labelInterval = Math.max(1, Math.ceil(strikes.length / maxLabels))

          return strikes.map((strike, idx) => {
            // Use row index for positioning instead of price scale
            const y = marginTop + (idx * cellHeight)
            const isSelected = selectedStrikes.has(strike)
            const shouldShowLabel = idx % labelInterval === 0 || isSelected

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
                {shouldShowLabel && (
                  <text
                    x={marginLeft - 15}
                    y={y + cellHeight / 2 + 4}
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
                )}
              </g>
            )
          })
        })()}

        {/* Price area (gradient fill) */}
        <path
          d={areaPath}
          fill="url(#priceGradient)"
          opacity={0.3}
        />

        {/* Price line */}
        <path
          d={linePath}
          fill="none"
          stroke="#0A0A0A"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair on hover */}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x}
              y1={marginTop}
              x2={hoveredPoint.x}
              y2={height - marginBottom}
              stroke="#0A0A0A"
              strokeWidth={1}
              strokeDasharray="2,2"
              opacity={0.3}
            />
            <line
              x1={marginLeft}
              y1={hoveredPoint.y}
              x2={marginLeft + historicalWidth}
              y2={hoveredPoint.y}
              stroke="#0A0A0A"
              strokeWidth={1}
              strokeDasharray="2,2"
              opacity={0.3}
            />
          </>
        )}

        {/* Interactive price points */}
        {linePathData.map((point, idx) => (
          <g key={`price-point-${idx}`}>
            {/* Invisible larger hit area */}
            <circle
              cx={point.x}
              cy={point.y}
              r={12}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
            {/* Visible dot on hover */}
            {(hoveredPoint === point || idx === linePathData.length - 1) && (
              <>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill="white"
                  stroke="#0A0A0A"
                  strokeWidth={2}
                />
                {hoveredPoint === point && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={6}
                    fill="none"
                    stroke="#0A0A0A"
                    strokeWidth={1}
                    opacity={0.3}
                  />
                )}
              </>
            )}
          </g>
        ))}

        {/* Current price line */}
        <line
          x1={marginLeft}
          y1={priceToRowY(currentPrice)}
          x2={width - marginRight}
          y2={priceToRowY(currentPrice)}
          stroke="#0047FF"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={1}
        />

        {/* Current price label */}
        {(() => {
          const priceText = `$${currentPrice.toFixed(2)}`
          const padding = 6
          const fontSize = 11
          // Approximate text width (roughly 0.6 * fontSize per character for monospace)
          const textWidth = priceText.length * fontSize * 0.55
          const textHeight = fontSize
          const boxWidth = textWidth + padding * 2
          const boxHeight = textHeight + padding * 2
          const centerX = marginLeft - 50

          return (
            <g>
              <rect
                x={centerX - boxWidth / 2}
                y={priceToRowY(currentPrice) - boxHeight / 2}
                width={boxWidth}
                height={boxHeight}
                fill="white"
                stroke="#0047FF"
                strokeWidth={0.5}
                rx={2}
              />
              <text
                x={centerX}
                y={priceToRowY(currentPrice) + fontSize / 3}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight="500"
                fill="#0047FF"
                fontFamily="DM Sans, sans-serif"
                letterSpacing="0.02em"
              >
                {priceText}
              </text>
            </g>
          )
        })()}

        {/* Cost basis line */}
        {costBasis && costBasis !== currentPrice && (
          <>
            <line
              x1={marginLeft}
              y1={priceToRowY(costBasis)}
              x2={width - marginRight}
              y2={priceToRowY(costBasis)}
              stroke="#10b981"
              strokeWidth={1}
              strokeDasharray="6,3"
              opacity={0.8}
            />
            {(() => {
              const basisText = `$${costBasis.toFixed(2)}`
              const padding = 6
              const fontSize = 11
              // Approximate text width (roughly 0.55 * fontSize per character)
              const textWidth = basisText.length * fontSize * 0.55
              const textHeight = fontSize
              const boxWidth = textWidth + padding * 2
              const boxHeight = textHeight + padding * 2
              const centerX = marginLeft - 50

              return (
                <g>
                  <rect
                    x={centerX - boxWidth / 2}
                    y={priceToRowY(costBasis) - boxHeight / 2}
                    width={boxWidth}
                    height={boxHeight}
                    fill="white"
                    stroke="#10b981"
                    strokeWidth={0.5}
                    rx={2}
                  />
                  <text
                    x={centerX}
                    y={priceToRowY(costBasis) + fontSize / 3}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight="500"
                    fill="#10b981"
                    fontFamily="DM Sans, sans-serif"
                    letterSpacing="0.02em"
                  >
                    {basisText}
                  </text>
                </g>
              )
            })()}
          </>
        )}

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
          const y = marginTop + (rowIdx * cellHeight)  // Row-based positioning
          const isStrikeSelected = selectedStrikes.has(strike)

          return row.map((cell, colIdx) => {
            // Skip rendering if no data
            if (!cell) return null

            const x = marginLeft + historicalWidth + (colIdx * cellWidth)
            const intensity = calculateIntensity(cell)

            const expDate = expirations[colIdx]
            const isExpSelected = selectedExpirations.has(expDate.toISOString())
            const isHighlighted = isStrikeSelected || isExpSelected

            // Calculate white-to-blue gradient color
            // Low intensity = white (#FFFFFF), High intensity = accent blue (#0047FF)
            const getHeatmapColor = (intensity) => {
              if (intensity === 0) return '#FAFAFA'

              // Interpolate between white (255,255,255) and accent blue (0,71,255)
              const r = Math.round(255 - (255 * intensity))
              const g = Math.round(255 - (184 * intensity))
              const b = 255

              return `rgb(${r}, ${g}, ${b})`
            }

            const cellColor = isHighlighted ? "#0047FF" : getHeatmapColor(intensity)
            const cellOpacity = isHighlighted ? 0.2 : 1

            const isHovered = hoveredCell === cell

            return (
              <g
                key={`cell-${rowIdx}-${colIdx}`}
                onClick={() => handleCellClick(cell)}
                onMouseEnter={() => setHoveredCell(cell)}
                onMouseLeave={() => setHoveredCell(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={cellWidth - 4}
                  height={cellHeight - 4}
                  fill={cellColor}
                  opacity={isHovered ? 0.7 : cellOpacity}
                  rx={0}
                  style={{ transition: 'opacity 0.15s ease' }}
                />
                {isHovered && (
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={cellWidth - 4}
                    height={cellHeight - 4}
                    fill="none"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                    rx={0}
                  />
                )}
                <text
                  x={x + cellWidth / 2}
                  y={y + cellHeight / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHighlighted || isHovered ? "600" : "500"}
                  fill={intensity > 0.5 ? "#FFFFFF" : (isHighlighted ? "#0047FF" : "#0A0A0A")}
                  fontFamily="DM Sans, sans-serif"
                  letterSpacing="0.01em"
                  style={{ pointerEvents: 'none' }}
                >
                  {heatmapMode === 'pc'
                    ? (cell.pcRatioVolume ? cell.pcRatioVolume.toFixed(2) : '0.00')
                    : `$${typeof cell.price === 'number' ? cell.price.toFixed(2) : cell.price}`
                  }
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

        {/* Tooltip rendered as SVG - placed last for z-index priority */}
        {hoveredPoint && (
          <g style={{ pointerEvents: 'none' }}>
            {/* Tooltip background */}
            <rect
              x={hoveredPoint.x - 60}
              y={hoveredPoint.y - 60}
              width={120}
              height={50}
              fill="white"
              stroke="#E8E8E8"
              strokeWidth={1}
              filter="url(#shadow)"
              rx={2}
            />
            {/* Tooltip date */}
            <text
              x={hoveredPoint.x}
              y={hoveredPoint.y - 40}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="#A3A3A3"
              fontFamily="DM Sans, sans-serif"
              letterSpacing="0.15em"
            >
              {hoveredPoint.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </text>
            {/* Tooltip price */}
            <text
              x={hoveredPoint.x}
              y={hoveredPoint.y - 20}
              textAnchor="middle"
              fontSize="16"
              fontWeight="500"
              fill="#0A0A0A"
              fontFamily="Manrope, sans-serif"
            >
              ${hoveredPoint.price.toFixed(2)}
            </text>
          </g>
        )}

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
          <div className="w-8 h-px" style={{ background: '#0047FF', borderTop: '1px dashed #0047FF' }} />
          <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Current
          </span>
        </div>
        {costBasis && costBasis !== currentPrice && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-px" style={{ background: '#10b981', borderTop: '1px dashed #10b981' }} />
            <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Cost Basis
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="w-6 h-3" style={{ background: 'var(--color-text-primary)', opacity: 0.08 }} />
          <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Intensity
          </span>
        </div>
      </div>
      </div>
    </div>
  )
}
