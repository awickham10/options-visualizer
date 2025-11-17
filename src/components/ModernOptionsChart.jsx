import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HeatmapToggle } from './HeatmapToggle'
import { CallPutToggle } from './CallPutToggle'
import { useOptionsData } from '../hooks/useOptionsData'
import { priceToRowY as priceToRowYUtil, percentile, calculateIntensityRanges, getHeatmapColor } from '../lib/chartUtils'
import { formatPrice, formatDateLabel } from '../lib/formatters'
import { logger } from '../lib/logger'

export function ModernOptionsChart({ data, symbol, optionsData = [], lastUpdated, onCellSelect, costBasis, onCostBasisChange }) {
  const [selectedExpirations, setSelectedExpirations] = useState(new Set())
  const [selectedStrikes, setSelectedStrikes] = useState(new Set())
  const [heatmapMode, setHeatmapMode] = useState('volume')
  const [optionType, setOptionType] = useState('call')
  const [isEditingCostBasis, setIsEditingCostBasis] = useState(false)
  const [tempCostBasis, setTempCostBasis] = useState('')
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [showStickyHeader, setShowStickyHeader] = useState(false)
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const headerRef = useRef(null)
  const inputRef = useRef(null)

  // Debug log whenever isEditingCostBasis changes
  logger.debug('ModernOptionsChart render, isEditingCostBasis:', isEditingCostBasis)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingCostBasis && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingCostBasis])

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

  // Throttle hover to reduce repaints - only update every 50ms
  const hoverTimeoutRef = useRef(null)
  const handleCellHover = useCallback((cell) => {
    if (hoverTimeoutRef.current) return

    setHoveredCell(cell)
    hoverTimeoutRef.current = setTimeout(() => {
      hoverTimeoutRef.current = null
    }, 50)
  }, [])

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null)
  }, [])

  // Track scroll position to show/hide sticky header using IntersectionObserver
  useEffect(() => {
    // Wait for both data and header ref to be available
    if (!data || data.length === 0 || !headerRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the top of the sentinel goes above the viewport, show sticky header
        const shouldShow = entry.boundingClientRect.top < 0
        setShowStickyHeader(shouldShow)
      },
      {
        root: null, // Use viewport as root
        threshold: [0, 0.1, 0.5, 1],
        rootMargin: '0px'
      }
    )

    const headerElement = headerRef.current
    observer.observe(headerElement)

    return () => {
      observer.disconnect()
    }
  }, [data?.length])  // Run when data length changes (more stable than data array)

  // Use custom hook to process options data
  const chartData = useOptionsData(data, optionsData, optionType)

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
  // Uses utility function from chartUtils.js
  const priceToRowY = (price) => {
    return priceToRowYUtil(price, strikes, marginTop, FIXED_CELL_HEIGHT)
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

  // Pre-calculate intensity ranges once per heatmap mode change
  // Uses utility function from chartUtils.js
  const intensityRanges = useMemo(() => {
    const validCells = optionsGrid.flat().filter(c => c)
    return calculateIntensityRanges(validCells, ['volume', 'iv', 'oi', 'pc', 'delta'])
  }, [optionsGrid])

  // Optimized intensity calculation using pre-calculated ranges
  const calculateIntensity = (cell) => {
    if (!cell) return 0

    let value = 0
    const range = intensityRanges[heatmapMode] || { min: 0, max: 1 }

    switch (heatmapMode) {
      case 'volume':
        value = cell.volume || 0
        break
      case 'iv':
        value = cell.impliedVolatility || 0
        break
      case 'oi':
        value = cell.openInterest || 0
        break
      case 'pc':
        value = cell.pcRatioVolume || 0
        break
      case 'delta':
        value = Math.abs(cell.delta || 0)
        break
      default:
        value = cell.volume || 0
    }

    // Normalize to 0-1 range based on percentiles (clamp outliers)
    if (range.max === range.min) return 0
    const intensity = (value - range.min) / (range.max - range.min)
    return Math.max(0, Math.min(intensity, 1))  // Clamp to [0, 1]
  }

  // Virtualization: Only render visible rows + buffer
  const OVERSCAN_ROWS = 5 // Render extra rows above/below viewport
  const containerHeight = height - marginTop - marginBottom
  const visibleRowCount = Math.ceil(containerHeight / cellHeight)
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / cellHeight) - OVERSCAN_ROWS)
  const lastVisibleRow = Math.min(strikes.length, firstVisibleRow + visibleRowCount + OVERSCAN_ROWS * 2)
  const visibleRows = optionsGrid.slice(firstVisibleRow, lastVisibleRow)

  return (
    <>
      {/* Sticky Header - rendered via portal to document.body */}
      {chartData && createPortal(
        <div
          className="left-0 right-0 bg-white transition-all duration-300 ease-out"
          style={{
            position: 'fixed',
            top: showStickyHeader ? '0' : '-200px',
            left: 0,
            right: 0,
            borderBottom: '1px solid var(--color-border)',
            opacity: showStickyHeader ? 1 : 0,
            boxShadow: showStickyHeader ? '0 4px 12px rgba(0, 0, 0, 0.08)' : 'none',
            zIndex: 1000,
            pointerEvents: showStickyHeader ? 'auto' : 'none'
          }}
        >
          <div className="max-w-[1800px] mx-auto px-8 py-4">
            <div className="flex items-center justify-between gap-8">
              {/* Left: Symbol + Price + Cost Basis */}
              <div className="flex items-center gap-6">
                <h3 className="text-3xl font-light tracking-[-0.02em]" style={{
                  color: 'var(--color-text-primary)',
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 300
                }}>
                  {symbol}
                </h3>

                <div className="h-8 w-px" style={{ background: 'var(--color-border)' }} />

                <div className="flex items-baseline gap-3">
                  <div className="text-[9px] uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                    Current
                  </div>
                  <div className="text-2xl font-light tracking-[-0.02em]" style={{
                    color: 'var(--color-text-primary)',
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 300
                  }}>
                    {formatPrice(currentPrice)}
                </div>
              </div>

              <div className="h-8 w-px" style={{ background: 'var(--color-border)' }} />

              {/* Cost Basis - Compact */}
              <div className="flex items-baseline gap-3">
                <span className="text-[9px] uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                  Cost Basis
                </span>
                {!isEditingCostBasis ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      logger.debug('Cost basis button clicked (sticky)')
                      setIsEditingCostBasis(true)
                      setTempCostBasis(costBasis?.toFixed(2) || currentPrice.toFixed(2))
                    }}
                    className="group relative text-lg font-medium tracking-tight transition-all group-hover:opacity-60"
                    style={{
                      cursor: 'pointer',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'DM Mono, monospace',
                      background: 'none',
                      border: 'none',
                      padding: 0
                    }}
                  >
                    ${(costBasis || currentPrice).toFixed(2)}
                    <div className="absolute -bottom-1 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{
                      background: 'var(--color-border)'
                    }} />
                  </button>
                ) : (
                  <input
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    value={tempCostBasis}
                    onChange={(e) => setTempCostBasis(e.target.value)}
                    onBlur={(e) => {
                      e.stopPropagation()
                      const newBasis = parseFloat(tempCostBasis)
                      if (!isNaN(newBasis) && newBasis > 0) {
                        onCostBasisChange(newBasis)
                      }
                      setIsEditingCostBasis(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        const newBasis = parseFloat(tempCostBasis)
                        if (!isNaN(newBasis) && newBasis > 0) {
                          onCostBasisChange(newBasis)
                        }
                        setIsEditingCostBasis(false)
                      } else if (e.key === 'Escape') {
                        e.stopPropagation()
                        setIsEditingCostBasis(false)
                      }
                    }}
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

              {/* Position P/L - Compact */}
              {costBasis && costBasis !== currentPrice && (
                <>
                  <div className="h-8 w-px" style={{ background: 'var(--color-border)' }} />
                  <div className="flex items-baseline gap-2">
                    <div className="text-[9px] uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                      P/L
                    </div>
                    <div className="text-base font-semibold" style={{
                      color: currentPrice > costBasis ? '#10b981' : currentPrice < costBasis ? '#ef4444' : 'var(--color-text-secondary)',
                      fontFamily: 'DM Mono, monospace'
                    }}>
                      {currentPrice > costBasis ? '+' : ''}{(((currentPrice - costBasis) / costBasis) * 100).toFixed(2)}%
                    </div>
                  </div>
                </>
              )}
              </div>

              {/* Right: Toggles */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                    Type
                  </span>
                  <CallPutToggle optionType={optionType} onTypeChange={setOptionType} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                    Heatmap
                  </span>
                  <HeatmapToggle mode={heatmapMode} onModeChange={setHeatmapMode} />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="relative" ref={containerRef}>
        {/* Sentinel element for IntersectionObserver */}
        <div ref={headerRef} style={{ position: 'absolute', top: 0, left: 0, width: '1px', height: '1px', pointerEvents: 'none' }} />

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
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    logger.debug('Cost basis button clicked (main)')
                    setIsEditingCostBasis(true)
                    setTempCostBasis(costBasis?.toFixed(2) || currentPrice.toFixed(2))
                  }}
                  className="group relative text-lg font-medium tracking-tight transition-all group-hover:opacity-60"
                  style={{
                    cursor: 'pointer',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'DM Mono, monospace',
                    background: 'none',
                    border: 'none',
                    padding: 0
                  }}
                >
                  ${(costBasis || currentPrice).toFixed(2)}
                  <div className="absolute -bottom-1 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{
                    background: 'var(--color-border)'
                  }} />
                </button>
              ) : (
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  value={tempCostBasis}
                  onChange={(e) => setTempCostBasis(e.target.value)}
                  onBlur={(e) => {
                    e.stopPropagation()
                    const newBasis = parseFloat(tempCostBasis)
                    if (!isNaN(newBasis) && newBasis > 0) {
                      onCostBasisChange(newBasis)
                    }
                    setIsEditingCostBasis(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      const newBasis = parseFloat(tempCostBasis)
                      if (!isNaN(newBasis) && newBasis > 0) {
                        onCostBasisChange(newBasis)
                      }
                      setIsEditingCostBasis(false)
                    } else if (e.key === 'Escape') {
                      e.stopPropagation()
                      setIsEditingCostBasis(false)
                    }
                  }}
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
          visibleRows.map((row, visibleIdx) => {
          const rowIdx = firstVisibleRow + visibleIdx
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

            const cellColor = isHighlighted ? "#0047FF" : getHeatmapColor(intensity)
            const cellOpacity = isHighlighted ? 0.2 : 1

            const isHovered = hoveredCell?.contractSymbol === cell.contractSymbol

            return (
              <g
                key={cell.contractSymbol}
                onClick={() => handleCellClick(cell)}
                onMouseEnter={() => handleCellHover(cell)}
                onMouseLeave={handleCellLeave}
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
                    : heatmapMode === 'delta'
                    ? (cell.delta ? cell.delta.toFixed(3) : '0.000')
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
              {formatDateLabel(point.date)}
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
              {formatDateLabel(expDate)}
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
              {formatDateLabel(hoveredPoint.date)}
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
              {formatPrice(hoveredPoint.price)}
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
    </>
  )
}
