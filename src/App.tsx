import { useState, useEffect, useRef, FormEvent } from 'react'
import { Activity } from 'lucide-react'
import { ModernOptionsChart, OptionCell } from './components/ModernOptionsChart'
import { useCoveredCallMetrics } from './hooks/useCoveredCallMetrics'
import { formatPrice, formatDate, formatGreek, formatIV } from './lib/formatters'
import { logger } from './lib/logger'
import { StockBar, OptionsData } from './types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface FullOptionData {
  latestQuote?: {
    bp?: number
    ap?: number
    bs?: number
    as?: number
  }
  latestTrade?: {
    p?: number
    s?: number
  }
  greeks?: {
    delta?: number
    gamma?: number
    theta?: number
    vega?: number
    implied_volatility?: number
  }
  openInterest?: number
}

function App() {
  const [symbol, setSymbol] = useState('')
  const [currentSymbol, setCurrentSymbol] = useState('')
  const [historicalData, setHistoricalData] = useState<StockBar[]>([])
  const [optionsData, setOptionsData] = useState<OptionsData>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<OptionCell | null>(null)
  const [costBasis, setCostBasis] = useState<number | null>(null) // User's purchase price
  const [loadingCellDetails, setLoadingCellDetails] = useState(false)

  // Cache for full option contract details
  const optionDetailsCache = useRef<Record<string, OptionCell>>({})


  const fetchStockData = async () => {
    if (!symbol.trim()) {
      setError('Please enter a stock symbol')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const symbolUpper = symbol.toUpperCase()

      // Fetch both historical data and options data in parallel
      const [barsResponse, optionsResponse] = await Promise.all([
        fetch(`/api/bars/${symbolUpper}?limit=100`),
        fetch(`/api/options/${symbolUpper}`)
      ])

      const barsData: ApiResponse<StockBar[]> = await barsResponse.json()
      const optionsDataResult: ApiResponse<OptionsData> = await optionsResponse.json()

      if (barsData.success && barsData.data) {
        setHistoricalData(barsData.data)
        setCurrentSymbol(symbolUpper)
        setLastUpdated(new Date().toISOString())

        // Set cost basis to current price by default
        if (barsData.data && barsData.data.length > 0) {
          const currentPrice = barsData.data[barsData.data.length - 1].close
          setCostBasis(currentPrice)
        }

        // Set options data if available
        if (optionsDataResult.success && optionsDataResult.data) {
          setOptionsData(optionsDataResult.data)
        } else {
          setOptionsData({})
          logger.warn('No options data available:', optionsDataResult.error)
        }
      } else {
        setError(barsData.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Failed to connect to server')
      logger.error('Failed to fetch stock data:', err)
    } finally {
      setLoading(false)
    }
  }


  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    fetchStockData()
  }

  const handleCellSelect = async (cell: OptionCell | null) => {
    if (!cell) {
      setSelectedCell(null)
      return
    }

    // Toggle: if clicking the same cell, close it
    if (selectedCell?.contractSymbol === cell.contractSymbol) {
      setSelectedCell(null)
      return
    }

    // Check cache first
    if (optionDetailsCache.current[cell.contractSymbol]) {
      // Merge cached details with basic cell data
      setSelectedCell({
        ...cell,
        ...optionDetailsCache.current[cell.contractSymbol]
      })
      return
    }

    // Set loading state and show basic cell data immediately
    setLoadingCellDetails(true)
    setSelectedCell(cell)

    try {
      // Fetch full contract details
      const response = await fetch(`/api/option/${cell.contractSymbol}`)
      const result: ApiResponse<FullOptionData> = await response.json()

      if (result.success && result.data) {
        const fullData = result.data

        // Extract all the detailed fields
        const detailedCell: OptionCell = {
          ...cell,
          // Update quote data if available
          bid: fullData.latestQuote?.bp || cell.bid,
          ask: fullData.latestQuote?.ap || cell.ask,
          bidSize: fullData.latestQuote?.bs || cell.bidSize,
          askSize: fullData.latestQuote?.as || cell.askSize,
          lastPrice: fullData.latestTrade?.p || cell.lastPrice,
          volume: fullData.latestTrade?.s || cell.volume,
          // Add greeks
          delta: fullData.greeks?.delta || 0,
          gamma: fullData.greeks?.gamma || 0,
          theta: fullData.greeks?.theta || 0,
          vega: fullData.greeks?.vega || 0,
          impliedVolatility: fullData.greeks?.implied_volatility || cell.impliedVolatility,
          openInterest: fullData.openInterest || cell.openInterest
        }

        // Cache the detailed data
        optionDetailsCache.current[cell.contractSymbol] = detailedCell

        setSelectedCell(detailedCell)
      } else {
        // If fetch fails, just use the basic cell data
        logger.warn('Failed to load option details:', result.error)
      }
    } catch (err) {
      logger.error('Error fetching option details:', err)
      // Keep showing basic data even if fetch fails
    } finally {
      setLoadingCellDetails(false)
    }
  }

  // Use covered call metrics hook for calculations
  const metrics = useCoveredCallMetrics(selectedCell, costBasis)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCell) {
        setSelectedCell(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCell])

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="container mx-auto px-8 py-16 max-w-[1800px]">
        {/* Header */}
        <header className="mb-20">
          <div className="flex items-end justify-between mb-16 pb-8" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <h1 className="text-[84px] font-light tracking-[-0.02em] leading-none mb-3" style={{
                color: 'var(--color-text-primary)',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 300
              }}>
                Options
              </h1>
              <p className="text-sm uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                Market Visualization
              </p>
            </div>
            {lastUpdated && (
              <div className="flex flex-col items-end gap-2">
                <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
                  Last Updated: {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="bg-white p-1" style={{ border: '1px solid var(--color-border)' }}>
            <form onSubmit={handleSubmit} className="flex gap-1">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="SYMBOL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="w-full px-6 py-6 text-2xl font-light tracking-[-0.01em] placeholder:font-light transition-all disabled:opacity-50 focus:outline-none"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'Manrope, sans-serif',
                    border: 'none'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-12 py-6 text-sm uppercase tracking-[0.2em] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                style={{
                  background: 'var(--color-accent)',
                  color: 'white'
                }}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                    <span>Analyzing</span>
                  </div>
                ) : (
                  'Analyze'
                )}
              </button>
            </form>
          </div>

          {error && (
            <div className="mt-4 px-6 py-4 text-sm" style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-accent)',
              color: 'var(--color-text-primary)'
            }}>
              {error}
            </div>
          )}
        </header>

        {/* Chart */}
        {currentSymbol && (
          <div className="animate-fade-in-up">
            <ModernOptionsChart
              data={historicalData}
              symbol={currentSymbol}
              optionsData={optionsData}
              lastUpdated={lastUpdated}
              onCellSelect={handleCellSelect}
              costBasis={costBasis}
              onCostBasisChange={setCostBasis}
            />
          </div>
        )}

        {/* Empty State */}
        {!currentSymbol && !loading && (
          <div className="mt-48 text-center">
            <div className="w-1 h-32 mx-auto mb-12" style={{ background: 'var(--color-border)' }} />
            <h3 className="text-xl uppercase tracking-[0.3em] font-light mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
              Ready
            </h3>
            <p className="text-sm tracking-[0.05em] max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              Enter a stock symbol to begin visualization
            </p>
          </div>
        )}
      </div>

      {/* Bottom Footer - Option Details */}
      <div
        className="fixed left-0 right-0 bottom-0 bg-white transition-all duration-300 ease-out"
        style={{
          borderTop: '1px solid var(--color-border)',
          zIndex: 1000,
          height: selectedCell ? '320px' : '0px',
          overflow: 'hidden'
        }}
      >
        {selectedCell && metrics && (
            <div className="h-full relative">
              {/* Loading overlay */}
              {loadingCellDetails && (
                <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 animate-spin" strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
                    <span className="text-sm uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Loading Details...
                    </span>
                  </div>
                </div>
              )}
              {/* Close button - top right */}
              <button
                onClick={() => setSelectedCell(null)}
                className="absolute top-4 right-8 text-xl hover:opacity-60 transition-opacity"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                ✕
              </button>

              <div className="max-w-[1800px] mx-auto px-8 py-6 h-full overflow-y-auto">
                {/* Header - Contract Info */}
                <div className="mb-6 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                    Selected Option
                  </div>
                  <div className="flex items-baseline gap-4">
                    <div className="text-sm font-mono tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                      {selectedCell.contractSymbol}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{
                      color: selectedCell.isITM ? 'var(--color-accent)' : 'var(--color-text-primary)'
                    }}>
                      {selectedCell.isITM ? 'ITM' : 'OTM'}
                    </div>
                  </div>
                </div>

                {/* Main Metrics Grid */}
                <div className="space-y-6">
                  {/* Row 1: Basic Info */}
                  <div className="grid grid-cols-6 gap-6">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Strike
                      </div>
                      <div className="text-2xl font-light tracking-[-0.02em]" style={{
                        color: 'var(--color-text-primary)',
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 300
                      }}>
                        {formatPrice(selectedCell.strike)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Expiration
                      </div>
                      <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        {formatDate(selectedCell.expDate, 'medium')}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {metrics?.daysToExpiration} DTE
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Premium (Bid)
                      </div>
                      <div className="text-2xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {formatPrice(selectedCell.bid)}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        × {selectedCell.bidSize}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Ask
                      </div>
                      <div className="text-xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {formatPrice(selectedCell.ask)}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        × {selectedCell.askSize}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Delta
                      </div>
                      <div className="text-xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.delta ? formatGreek(selectedCell.delta, 'delta') : 'N/A'}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        {selectedCell.delta ? `~${(Math.abs(selectedCell.delta) * 100).toFixed(0)}% prob` : ''}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Theta
                      </div>
                      <div className="text-xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.theta ? formatGreek(selectedCell.theta, 'theta') : 'N/A'}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        per day
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'var(--color-border)' }} />

                  {/* Row 2: Covered Call Returns */}
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4 flex items-center gap-3" style={{ color: 'var(--color-text-tertiary)' }}>
                      Covered Call Analysis
                      {metrics?.usingCostBasis && (
                        <span className="text-[8px] px-2 py-1 rounded" style={{
                          background: 'var(--color-accent)',
                          color: 'white',
                          opacity: 0.8
                        }}>
                          USING COST BASIS
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-6">
                      {/* Current Position (only show if using custom cost basis) */}
                      {metrics?.usingCostBasis && (
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Current Position
                          </div>
                          <div className="text-2xl font-medium" style={{
                            color: metrics?.currentPosition && metrics.currentPosition > 0 ? '#10b981' : metrics?.currentPosition && metrics.currentPosition < 0 ? '#ef4444' : 'var(--color-text-primary)'
                          }}>
                            {metrics?.currentPosition !== undefined ? `${metrics.currentPosition > 0 ? '+' : ''}${metrics.currentPosition.toFixed(2)}%` : 'N/A'}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                            Unrealized
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                          {metrics?.usingCostBasis ? 'Premium Yield' : 'Premium Return'}
                        </div>
                        <div className="text-2xl font-medium" style={{
                          color: metrics?.premiumReturnOnCost && metrics.premiumReturnOnCost > 0 ? '#10b981' : 'var(--color-text-primary)'
                        }}>
                          {metrics?.premiumReturnOnCost ? `${metrics.premiumReturnOnCost.toFixed(2)}%` : 'N/A'}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          Annualized
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                          Return If Called
                        </div>
                        <div className="text-2xl font-medium" style={{
                          color: metrics?.returnIfCalled && metrics.returnIfCalled > 0 ? '#10b981' : '#ef4444'
                        }}>
                          {metrics?.returnIfCalled ? `${metrics.returnIfCalled.toFixed(2)}%` : 'N/A'}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          Annualized
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                          Total Return
                        </div>
                        <div className="text-2xl font-medium" style={{
                          color: metrics?.totalReturnIfCalled && metrics.totalReturnIfCalled > 0 ? '#10b981' : '#ef4444'
                        }}>
                          {metrics?.totalReturnIfCalled !== undefined ? `${metrics.totalReturnIfCalled > 0 ? '+' : ''}${metrics.totalReturnIfCalled.toFixed(2)}%` : 'N/A'}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          If called
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                          Breakeven
                        </div>
                        <div className="text-2xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          ${metrics?.breakeven ? metrics.breakeven.toFixed(2) : 'N/A'}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          {metrics?.breakevenPercent ? `${metrics.breakevenPercent.toFixed(1)}% cushion` : 'Cost - premium'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'var(--color-border)' }} />

                  {/* Row 3: Greeks & Additional Data */}
                  <div className="grid grid-cols-6 gap-6">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Gamma
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.gamma ? formatGreek(selectedCell.gamma, 'gamma') : 'N/A'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Vega
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.vega ? formatGreek(selectedCell.vega, 'vega') : 'N/A'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Implied Vol
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.impliedVolatility ? formatIV(selectedCell.impliedVolatility) : 'N/A'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Volume
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.volume > 0 ? selectedCell.volume.toLocaleString() : 'N/A'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Open Interest
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.openInterest > 0 ? selectedCell.openInterest.toLocaleString() : 'N/A'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Last
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {selectedCell.lastPrice > 0 ? `$${selectedCell.lastPrice.toFixed(2)}` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
  )
}

export default App
