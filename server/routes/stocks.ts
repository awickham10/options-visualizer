import express, { Request, Response } from 'express'
import logger from '../utils/logger'
import { fetchBars, fetchQuote } from '../api/alpacaService'
import { Logger } from '../types'

const router = express.Router()

// Extend Request to include logger
interface RequestWithLogger extends Request {
  logger?: Logger
}

/**
 * GET /api/bars/:symbol
 * Get historical bars for a symbol
 */
router.get('/bars/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params
    const { timeframe, start, end, limit } = req.query

    const result = await fetchBars(symbol, {
      timeframe: timeframe as string,
      start: start as string,
      end: end as string,
      limit: limit ? Number(limit) : undefined
    })
    res.json(result)
  } catch (error) {
    const reqLogger = (req as RequestWithLogger).logger || logger
    const err = error as Error
    reqLogger.error(`Error fetching bars for ${req.params.symbol}: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/quote/:symbol
 * Get latest quote for a symbol
 */
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params
    const result = await fetchQuote(symbol)
    res.json(result)
  } catch (error) {
    const reqLogger = (req as RequestWithLogger).logger || logger
    const err = error as Error
    reqLogger.error(`Error fetching quote for ${req.params.symbol}: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
