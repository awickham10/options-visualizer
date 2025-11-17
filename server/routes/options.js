const express = require('express');
const logger = require('../utils/logger');
const { fetchOptionsData, fetchOptionContract } = require('../api/alpacaService');

const router = express.Router();

/**
 * GET /api/options/:symbol
 * Get options chain/snapshots for a symbol
 */
router.get('/options/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { minimal = 'false' } = req.query;

    // Calculate date range - start from 2 weeks out to avoid near-term expiry
    // and go out 6 months for longer-term options
    const today = new Date();
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    const sixMonthsLater = new Date(today);
    sixMonthsLater.setMonth(today.getMonth() + 6);

    const expirationDateGte = twoWeeksFromNow.toISOString().split('T')[0];
    const expirationDateLte = sixMonthsLater.toISOString().split('T')[0];

    const allSnapshots = await fetchOptionsData(symbol, expirationDateGte, expirationDateLte, minimal === 'true');

    res.json({ success: true, data: allSnapshots });
  } catch (error) {
    const reqLogger = req.logger || logger;
    reqLogger.error({ error: error.message, stack: error.stack, symbol }, 'Error fetching options');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/option/:contractSymbol
 * Get single option contract details
 */
router.get('/option/:contractSymbol', async (req, res) => {
  try {
    const { contractSymbol } = req.params;
    const result = await fetchOptionContract(contractSymbol);
    res.json(result);
  } catch (error) {
    const reqLogger = req.logger || logger;
    reqLogger.error({ error: error.message, stack: error.stack, contractSymbol }, 'Error fetching option contract');
    const statusCode = error.message === 'Invalid contract symbol' ? 400 :
                       error.message === 'Contract not found' ? 404 : 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

module.exports = router;
