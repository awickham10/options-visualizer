// Core data types for the Options Visualizer application

/**
 * Stock bar (OHLCV) data point
 */
export interface StockBar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Stock quote data
 */
export interface Quote {
  bidPrice: number
  askPrice: number
  bidSize: number
  askSize: number
  timestamp: string
}

/**
 * Option Greeks
 */
export interface OptionGreeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho?: number
}

/**
 * Option quote (bid/ask)
 */
export interface OptionQuote {
  bp: number  // bid price
  ap: number  // ask price
  bs: number  // bid size
  as: number  // ask size
  t?: string  // timestamp
}

/**
 * Option trade
 */
export interface OptionTrade {
  p: number  // price
  s: number  // size
  t?: string // timestamp
  x?: string // exchange
}

/**
 * Full option contract snapshot from Alpaca API
 */
export interface OptionSnapshot {
  latestQuote: OptionQuote | null
  latestTrade: OptionTrade | null
  openInterest: number
  impliedVolatility: number
  greeks: OptionGreeks | null
}

/**
 * Options data keyed by contract symbol
 */
export type OptionsData = Record<string, OptionSnapshot>

/**
 * Parsed option contract details
 */
export interface ParsedOptionContract {
  contractSymbol: string
  underlying: string
  expiration: string
  expirationDate: Date
  strike: number
  type: 'call' | 'put'
  bidPrice: number
  askPrice: number
  lastPrice: number
  volume: number
  openInterest: number
  impliedVolatility: number
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
  rho?: number
  inTheMoney: boolean
  spread: number
  midPrice: number
}

/**
 * Heatmap visualization modes
 */
export type HeatmapMode = 'spread' | 'iv' | 'pc_ratio' | 'oi' | 'delta' | 'gamma' | 'theta' | 'vega'

/**
 * Call or Put toggle
 */
export type OptionType = 'call' | 'put' | 'both'

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp?: string
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 'stock_bar' | 'options_snapshot' | 'error' | 'subscribed'

export interface WebSocketMessage {
  type: WebSocketMessageType
  symbol?: string
  data?: unknown
  message?: string
  error?: string
}

/**
 * Stock bar WebSocket message
 */
export interface StockBarMessage extends WebSocketMessage {
  type: 'stock_bar'
  data: StockBar
}

/**
 * Options snapshot WebSocket message
 */
export interface OptionsSnapshotMessage extends WebSocketMessage {
  type: 'options_snapshot'
  data: OptionsData
}

/**
 * Covered call metrics
 */
export interface CoveredCallMetrics {
  contractSymbol: string
  strike: number
  expiration: string
  premium: number
  annualizedReturn: number
  maxProfit: number
  breakeven: number
  daysToExpiration: number
  returnIfCalled: number
  returnIfUnchanged: number
}
