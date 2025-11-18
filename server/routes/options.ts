import express, { Request, Response } from 'express'
import logger from '../utils/logger'
import { fetchOptionsData, fetchOptionContract } from '../api/alpacaService'
import { Logger } from '../types'

const router = express.Router()

// Extend Request to include logger
interface RequestWithLogger extends Request {
  logger?: Logger
}

/**
 * GET /api/options/:symbol
 * Get options chain/snapshots for a symbol
 */
router.get('/options/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params
    const { minimal = 'false' } = req.query

    // Calculate date range - start from 2 weeks out to avoid near-term expiry
    // and go out 6 months for longer-term options
    const today = new Date()
    const twoWeeksFromNow = new Date(today)
    twoWeeksFromNow.setDate(today.getDate() + 14)

    const sixMonthsLater = new Date(today)
    sixMonthsLater.setMonth(today.getMonth() + 6)

    const expirationDateGte = twoWeeksFromNow.toISOString().split('T')[0]
    const expirationDateLte = sixMonthsLater.toISOString().split('T')[0]

    const allSnapshots = await fetchOptionsData(symbol, expirationDateGte, expirationDateLte, minimal === 'true')

    res.json({ success: true, data: allSnapshots })
  } catch (error) {
    const reqLogger = (req as RequestWithLogger).logger || logger
    const err = error as Error
    reqLogger.error(`Error fetching options for ${req.params.symbol}: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/option/:contractSymbol
 * Get single option contract details
 */
router.get('/option/:contractSymbol', async (req: Request, res: Response) => {
  try {
    const { contractSymbol } = req.params
    const result = await fetchOptionContract(contractSymbol)
    res.json(result)
  } catch (error) {
    const reqLogger = (req as RequestWithLogger).logger || logger
    const err = error as Error
    reqLogger.error(`Error fetching option contract ${req.params.contractSymbol}: ${err.message}`)
    const statusCode = err.message === 'Invalid contract symbol' ? 400 :
                       err.message === 'Contract not found' ? 404 : 500
    res.status(statusCode).json({ success: false, error: err.message })
  }
})

export default router
