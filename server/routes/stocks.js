const express = require('express');
const { fetchBars, fetchQuote } = require('../api/alpacaService');

const router = express.Router();

/**
 * GET /api/bars/:symbol
 * Get historical bars for a symbol
 */
router.get('/bars/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe, start, end, limit } = req.query;

    const result = await fetchBars(symbol, { timeframe, start, end, limit });
    res.json(result);
  } catch (error) {
    console.error('Error fetching bars:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/quote/:symbol
 * Get latest quote for a symbol
 */
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await fetchQuote(symbol);
    res.json(result);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
