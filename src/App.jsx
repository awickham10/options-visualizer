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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-12 max-w-[1600px]">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-500 rounded-2xl shadow-lg">
                <TrendingUp className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-6xl font-bold text-gray-900">
                  Options Visualizer
                </h1>
                <p className="text-gray-500 text-xl mt-2">Real-time market intelligence</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-full border-2 border-gray-200 shadow-sm">
                <div className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium text-gray-700">
                  {isStreaming ? 'Live Data' : 'REST API'}
                </span>
              </div>
              {lastUpdated && (
                <div className="text-xs text-gray-500 text-right">
                  Updated: {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-lg">
            <form onSubmit={handleSubmit} className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter symbol (AAPL, TSLA, SPY...)"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="w-full pl-14 pr-6 py-5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all disabled:opacity-50 text-lg font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-10 py-5 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 animate-spin" />
                    Loading
                  </div>
                ) : (
                  'Analyze'
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 font-medium">
                {error}
              </div>
            )}
          </div>
        </header>

        {/* Chart */}
        {currentSymbol && (
          <div className="animate-fadeIn">
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
          <div className="mt-32 text-center">
            <div className="inline-block p-8 bg-white rounded-3xl border-2 border-gray-200 mb-6 shadow-lg">
              <Activity className="w-20 h-20 text-gray-300 mx-auto" strokeWidth={2} />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-3">Ready to analyze</h3>
            <p className="text-gray-500 text-lg max-w-md mx-auto">
              Enter a stock symbol above to visualize historical prices and options data
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}

export default App
