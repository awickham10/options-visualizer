const alpaca = require('../config/alpaca');
require('dotenv').config();

/**
 * Alpaca API Service Layer
 * Provides clean abstraction over Alpaca API calls
 * All functions return standardized response format: { success, data?, error? }
 */

/**
 * Fetch historical bars for a symbol
 * @param {string} symbol - Stock ticker symbol
 * @param {object} options - Query parameters (timeframe, start, end, limit)
 * @returns {Promise<object>} - { success, data, timestamp }
 */
async function fetchBars(symbol, options = {}) {
  const { timeframe = '1Day', start, end, limit = 100 } = options;

  // Request last 150 days with descending sort to get most recent bars
  const startDate = start || new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = end || new Date().toISOString();

  const bars = await alpaca.getBarsV2(symbol, {
    start: startDate,
    end: endDate,
    timeframe,
    limit: parseInt(limit),
    sort: 'desc',  // Sort descending to get most recent bars first
    feed: 'iex'  // Use IEX feed for free tier access
  });

  const data = [];
  for await (let bar of bars) {
    data.push({
      time: bar.Timestamp,
      open: bar.OpenPrice,
      high: bar.HighPrice,
      low: bar.LowPrice,
      close: bar.ClosePrice,
      volume: bar.Volume
    });
  }

  // Reverse to get chronological order (oldest to newest)
  data.reverse();

  return { success: true, data, timestamp: new Date().toISOString() };
}

/**
 * Fetch latest quote for a symbol
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<object>} - { success, data }
 */
async function fetchQuote(symbol) {
  const quote = await alpaca.getLatestQuote(symbol);

  return {
    success: true,
    data: {
      bidPrice: quote.BidPrice,
      askPrice: quote.AskPrice,
      bidSize: quote.BidSize,
      askSize: quote.AskSize,
      timestamp: quote.Timestamp
    }
  };
}

/**
 * Fetch options chain data for a symbol within a date range
 * @param {string} symbol - Underlying stock ticker symbol
 * @param {string} expirationDateGte - Start date (YYYY-MM-DD)
 * @param {string} expirationDateLte - End date (YYYY-MM-DD)
 * @param {boolean} minimal - If true, returns only essential grid data (strips extra fields)
 * @returns {Promise<object>} - Options snapshots object
 */
async function fetchOptionsData(symbol, expirationDateGte, expirationDateLte, minimal = false) {
  const apiUrl = `https://data.alpaca.markets/v1beta1/options/snapshots/${symbol}`;

  // Fetch calls
  const callParams = new URLSearchParams({
    type: 'call',
    expiration_date_gte: expirationDateGte,
    expiration_date_lte: expirationDateLte,
    limit: 1000
  });

  // Fetch puts
  const putParams = new URLSearchParams({
    type: 'put',
    expiration_date_gte: expirationDateGte,
    expiration_date_lte: expirationDateLte,
    limit: 1000
  });

  const [callResponse, putResponse] = await Promise.all([
    fetch(`${apiUrl}?${callParams}`, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET
      }
    }),
    fetch(`${apiUrl}?${putParams}`, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET
      }
    })
  ]);

  const [callData, putData] = await Promise.all([
    callResponse.json(),
    putResponse.json()
  ]);

  if (!callResponse.ok) {
    throw new Error(callData.message || 'Failed to fetch call options');
  }
  if (!putResponse.ok) {
    throw new Error(putData.message || 'Failed to fetch put options');
  }

  // Merge both calls and puts
  const allSnapshots = {
    ...(callData.snapshots || {}),
    ...(putData.snapshots || {})
  };

  // If minimal, only return essential grid data (strip greeks and extra fields)
  if (minimal) {
    const minimalData = {};
    Object.entries(allSnapshots).forEach(([contractSymbol, optData]) => {
      const latestQuote = optData.latestQuote;
      const latestTrade = optData.latestTrade;
      const greeks = optData.greeks;

      minimalData[contractSymbol] = {
        latestQuote: latestQuote ? {
          bp: latestQuote.bp || 0,
          ap: latestQuote.ap || 0,
          bs: latestQuote.bs || 0,
          as: latestQuote.as || 0
        } : null,
        latestTrade: latestTrade ? {
          p: latestTrade.p || 0,
          s: latestTrade.s || 0
        } : null,
        openInterest: optData.openInterest || 0,
        impliedVolatility: optData.impliedVolatility || 0,
        greeks: greeks ? {
          delta: greeks.delta || 0,
          gamma: greeks.gamma || 0,
          theta: greeks.theta || 0,
          vega: greeks.vega || 0
        } : null
      };
    });
    return minimalData;
  }

  return allSnapshots;
}

/**
 * Fetch single option contract details by contract symbol
 * @param {string} contractSymbol - Full option contract symbol (e.g., AAPL250117C00150000)
 * @returns {Promise<object>} - { success, data } or { success: false, error }
 */
async function fetchOptionContract(contractSymbol) {
  // Parse contract symbol to get underlying symbol and expiration
  // Format: AAPL250117C00150000 (symbol + YYMMDD + C/P + strike)
  const match = contractSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  if (!match) {
    throw new Error('Invalid contract symbol');
  }

  const [, symbol, dateStr, optType, strikeStr] = match;

  // Parse expiration date
  const year = 2000 + parseInt(dateStr.substring(0, 2));
  const month = parseInt(dateStr.substring(2, 4));
  const day = parseInt(dateStr.substring(4, 6));

  // Calculate date range (fetch options around this expiration)
  const expDate = new Date(year, month - 1, day);
  const oneDayBefore = new Date(expDate);
  oneDayBefore.setDate(expDate.getDate() - 1);
  const oneDayAfter = new Date(expDate);
  oneDayAfter.setDate(expDate.getDate() + 1);

  const expirationDateGte = oneDayBefore.toISOString().split('T')[0];
  const expirationDateLte = oneDayAfter.toISOString().split('T')[0];

  // Fetch options data (not minimal - we want full details)
  const allSnapshots = await fetchOptionsData(symbol, expirationDateGte, expirationDateLte, false);

  // Find the specific contract
  const contractData = allSnapshots[contractSymbol];

  if (!contractData) {
    throw new Error('Contract not found');
  }

  return { success: true, data: contractData };
}

module.exports = {
  fetchBars,
  fetchQuote,
  fetchOptionsData,
  fetchOptionContract
};
