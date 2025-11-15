import React, { useState, useEffect, useRef } from 'react'
import { TrendingUp, Search, Activity } from 'lucide-react'
import { ModernOptionsChart } from './components/ModernOptionsChart'

function App() {
  const [symbol, setSymbol] = useState('')
  const [currentSymbol, setCurrentSymbol] = useState('')
  const [historicalData, setHistoricalData] = useState([])
  const [optionsData, setOptionsData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const wsRef = useRef(null)

  // Check streaming status on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        // Update streaming status but don't block the app
        setIsStreaming(data.streaming || false)
      } catch (err) {
        console.error('Health check failed:', err)
      }
    }

    checkHealth()
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000)

    return () => clearInterval(interval)
  }, [])

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const fetchStockData = async () => {
    if (!symbol.trim()) {
      setError('Please enter a stock symbol')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch historical data first
      const barsResponse = await fetch(`/api/bars/${symbol.toUpperCase()}?limit=100`)
      const barsData = await barsResponse.json()

      if (barsData.success) {
        setHistoricalData(barsData.data)
        setCurrentSymbol(symbol.toUpperCase())
        setLastUpdated(barsData.timestamp || new Date().toISOString())

        // Connect to WebSocket for real-time updates
        connectWebSocket(symbol.toUpperCase())
      } else {
        setError(barsData.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = (sym) => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket('ws://localhost:3001')

    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsStreaming(true)
      // Subscribe to symbol
      ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'stock_bar') {
        // Add new bar to historical data
        setHistoricalData(prev => {
          const newData = [...prev, {
            time: message.data.time,
            open: message.data.open,
            high: message.data.high,
            low: message.data.low,
            close: message.data.close,
            volume: message.data.volume
          }]
          // Keep last 100 bars
          return newData.slice(-100)
        })
        setLastUpdated(new Date().toISOString())
      } else if (message.type === 'options_snapshot') {
        // Update options data
        setOptionsData(message.data)
        setLastUpdated(new Date().toISOString())
      } else if (message.type === 'error') {
        console.error('WebSocket error:', message.error)
        setError(message.error)
      } else if (message.type === 'subscribed') {
        console.log(`Subscribed to ${message.symbol}`)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsStreaming(false)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsStreaming(false)
    }

    wsRef.current = ws
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    fetchStockData()
  }

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
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 ${isStreaming ? 'animate-pulse' : ''}`} style={{
                  background: isStreaming ? 'var(--color-accent)' : 'var(--color-text-tertiary)'
                }} />
                <span className="text-xs uppercase tracking-[0.15em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {isStreaming ? 'Live' : 'Static'}
                </span>
              </div>
              {lastUpdated && (
                <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
                  {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              )}
            </div>
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
    </div>
  )
}

export default App
