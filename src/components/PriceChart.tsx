import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { StockBar } from '../types'

interface ChartDataPoint {
  date: string
  price: number
  volume: number
}

export interface PriceChartProps {
  data: StockBar[]
  symbol: string
  costBasis?: number | null
  currentPrice?: number | null
}

export function PriceChart({ data, symbol, costBasis, currentPrice }: PriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No data available
      </div>
    )
  }

  const chartData: ChartDataPoint[] = data.map(bar => ({
    date: new Date(bar.time).toLocaleDateString(),
    price: bar.close,
    volume: bar.volume
  }))

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">{symbol} Price History</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={['auto', 'auto']}
          />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
          {currentPrice && (
            <ReferenceLine
              y={currentPrice}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: `Current: $${currentPrice.toFixed(2)}`,
                position: 'right',
                fill: '#ef4444',
                fontSize: 12,
                fontWeight: 600
              }}
            />
          )}
          {costBasis && costBasis !== currentPrice && (
            <ReferenceLine
              y={costBasis}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `Cost Basis: $${costBasis.toFixed(2)}`,
                position: 'right',
                fill: '#10b981',
                fontSize: 12,
                fontWeight: 600
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
