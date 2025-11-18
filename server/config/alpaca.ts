import Alpaca from '@alpacahq/alpaca-trade-api'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Initialize and export the Alpaca API client
 * Centralized configuration for all Alpaca API interactions
 */
const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_API_SECRET,
  paper: process.env.ALPACA_PAPER === 'true',
  baseUrl: process.env.ALPACA_BASE_URL || 'https://api.alpaca.markets',
  feed: 'iex' // Use IEX feed for free tier
})

export default alpaca
