import { useMemo } from 'react'
import { StockBar } from '../types'

interface MockOptionsData {
  strikes: number[]
  expirations: Date[]
}

export interface OptionsGridProps {
  currentPrice: number | null
  historicalData: StockBar[]
}

export function OptionsGrid({ currentPrice }: OptionsGridProps) {
  // Generate mock options data based on current price
  // In a real scenario, this would come from options chain API
  const optionsData = useMemo((): MockOptionsData => {
    if (!currentPrice) return { strikes: [], expirations: [] }

    const basePrice = currentPrice
    const strikes: number[] = []
    const expirations: Date[] = []

    // Generate strike prices (5% above and below current price)
    for (let i = -5; i <= 5; i++) {
      const strike = basePrice * (1 + (i * 0.01))
      strikes.push(Math.round(strike * 100) / 100)
    }

    // Generate expiration dates (next 4 weeks)
    const today = new Date()
    for (let i = 1; i <= 4; i++) {
      const expDate = new Date(today)
      expDate.setDate(today.getDate() + (i * 7))
      expirations.push(expDate)
    }

    return { strikes, expirations }
  }, [currentPrice])

  if (!currentPrice) {
    return (
      <div className="text-gray-500 text-center p-8">
        Load stock data to see options grid
      </div>
    )
  }

  // Calculate intrinsic value for calls (simplified)
  const calculateCallValue = (strike: number): string => {
    const intrinsic = Math.max(0, currentPrice - strike)
    const timeValue = Math.random() * 5 // Mock time value
    return (intrinsic + timeValue).toFixed(2)
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Options Chain (Call Options)</h3>
      <div className="text-sm text-gray-600 mb-2">
        Current Price: ${currentPrice.toFixed(2)}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left border-b">Strike Price</th>
              {optionsData.expirations.map((exp, idx) => (
                <th key={idx} className="px-4 py-2 text-center border-b border-l">
                  {exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {optionsData.strikes.map((strike, rowIdx) => (
              <tr
                key={rowIdx}
                className={strike === Math.round(currentPrice * 100) / 100 ? 'bg-blue-50' : ''}
              >
                <td className="px-4 py-2 font-semibold border-b">
                  ${strike.toFixed(2)}
                </td>
                {optionsData.expirations.map((_, colIdx) => {
                  const value = calculateCallValue(strike)
                  const isITM = strike < currentPrice
                  return (
                    <td
                      key={colIdx}
                      className={`px-4 py-2 text-center border-b border-l ${
                        isITM ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      ${value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>Green = In the Money (ITM), Red = Out of the Money (OTM)</p>
        <p>Note: This is simulated options data. Connect to a real options data provider for live data.</p>
      </div>
    </div>
  )
}
