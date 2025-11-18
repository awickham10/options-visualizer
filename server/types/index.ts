import { Request } from 'express'

/**
 * Extended Express Request with requestId
 */
export interface RequestWithId extends Request {
  id?: string
}

/**
 * Stock bar data from Alpaca
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
 * Quote data
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
 * Option quote from Alpaca
 */
export interface OptionQuote {
  bp: number  // bid price
  ap: number  // ask price
  bs: number  // bid size
  as: number  // ask size
  t?: string  // timestamp
}

/**
 * Option trade from Alpaca
 */
export interface OptionTrade {
  p: number  // price
  s: number  // size
  t?: string // timestamp
  x?: string // exchange
}

/**
 * Full option snapshot from Alpaca
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
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  timestamp?: string
}

/**
 * Fetch bars options
 */
export interface FetchBarsOptions {
  timeframe?: string
  start?: string
  end?: string
  limit?: number
}

/**
 * Logger interface
 */
export interface Logger {
  info: (msg: string, ...args: unknown[]) => void
  error: (msg: string, ...args: unknown[]) => void
  warn: (msg: string, ...args: unknown[]) => void
  debug: (msg: string, ...args: unknown[]) => void
  child: (bindings: Record<string, unknown>) => Logger
}
