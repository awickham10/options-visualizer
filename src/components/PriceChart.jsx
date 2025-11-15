import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export function PriceChart({ data, symbol }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No data available
      </div>
    )
  }

  const chartData = data.map(bar => ({
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
