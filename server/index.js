const express = require('express');
const cors = require('cors');
const Alpaca = require('@alpacahq/alpaca-trade-api');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize Alpaca client
const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_API_SECRET,
  paper: process.env.ALPACA_PAPER === 'true',
  baseUrl: process.env.ALPACA_BASE_URL || 'https://api.alpaca.markets',
  feed: 'iex' // Use IEX feed for free tier
});

// Get historical bars for a symbol
app.get('/api/bars/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1Day', start, end, limit = 100 } = req.query;

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

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching bars:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get latest quote for a symbol
app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await alpaca.getLatestQuote(symbol);

    res.json({
      success: true,
      data: {
        bidPrice: quote.BidPrice,
        askPrice: quote.AskPrice,
        bidSize: quote.BidSize,
        askSize: quote.AskSize,
        timestamp: quote.Timestamp
      }
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to fetch both puts and calls
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

// Get single option contract details
app.get('/api/option/:contractSymbol', async (req, res) => {
  try {
    const { contractSymbol } = req.params;

    // Parse contract symbol to get underlying symbol and expiration
    // Format: AAPL250117C00150000 (symbol + YYMMDD + C/P + strike)
    const match = contractSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
    if (!match) {
      return res.status(400).json({ success: false, error: 'Invalid contract symbol' });
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
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    res.json({ success: true, data: contractData });
  } catch (error) {
    console.error('Error fetching option contract:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get options chain/snapshots for a symbol
app.get('/api/options/:symbol', async (req, res) => {
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
    console.error('Error fetching options:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize single shared Alpaca data stream
let alpacaStream = null;
let streamConnected = false;
let streamingEnabled = true; // Can be disabled if not available
let authErrorCount = 0;
const MAX_AUTH_FAILURES = 3;

const initializeAlpacaStream = async () => {
  if (!alpacaStream && streamingEnabled) {
    alpacaStream = alpaca.data_stream_v2;

    alpacaStream.onError((error) => {
      console.error('Alpaca stream error:', error);
      if (error.toString().includes('auth failed')) {
        authErrorCount++;
        if (authErrorCount >= MAX_AUTH_FAILURES) {
          console.warn('WARNING: Real-time streaming not available. App will use REST API only.');
          streamingEnabled = false;
          streamConnected = false;
          // Don't treat streaming failure as critical - REST API still works
        }
      } else {
        streamConnected = false;
      }
    });

    alpacaStream.onStateChange((state) => {
      console.log('Alpaca stream state:', state);
      if (state === 'authenticated') {
        streamConnected = true;
        authErrorCount = 0;
        console.log('Real-time streaming enabled');
      }
    });

    try {
      await alpacaStream.connect();
      console.log('Alpaca data stream connected');
    } catch (error) {
      console.error('Failed to connect Alpaca stream:', error);
      streamConnected = false;
    }
  }
  return alpacaStream;
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: streamConnected ? 'connected' : 'disconnected',
    streaming: streamConnected,
    streamingEnabled: streamingEnabled
  });
});

// Initialize stream on server start
initializeAlpacaStream().catch(err => {
  console.error('Failed to initialize Alpaca stream:', err);
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');

  let currentSymbol = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe') {
        const { symbol } = data;
        console.log(`Subscribing to ${symbol} streams`);

        // Check if stream is connected
        if (!streamConnected) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Real-time data stream not available. Showing historical data only.'
          }));
          console.warn('Alpaca stream not connected, skipping subscription');
        } else {
          // Unsubscribe from previous symbol if any
          if (currentSymbol) {
            try {
              await alpacaStream.unsubscribe(['bars'], [currentSymbol]);
              console.log(`Unsubscribed from ${currentSymbol}`);
            } catch (e) {
              console.log('Error unsubscribing:', e.message);
            }
          }

          // Set up bar handler for this symbol
          alpacaStream.onStockBar(symbol, (bar) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'stock_bar',
                data: {
                  symbol: bar.Symbol,
                  time: bar.Timestamp,
                  open: bar.OpenPrice,
                  high: bar.HighPrice,
                  low: bar.LowPrice,
                  close: bar.ClosePrice,
                  volume: bar.Volume
                }
              }));
            }
          });

          // Subscribe to bars for this symbol
          try {
            await alpacaStream.subscribe(['bars'], [symbol]);
            currentSymbol = symbol;
            console.log(`Subscribed to bars for ${symbol}`);
          } catch (error) {
            console.error('Failed to subscribe:', error);
            ws.send(JSON.stringify({ type: 'error', error: 'Failed to subscribe to real-time data' }));
          }
        }

        // Fetch and send initial options contracts (2 weeks to 6 months out)
        // Use minimal=true to only send essential grid data
        try {
          const today = new Date();
          const twoWeeksFromNow = new Date(today);
          twoWeeksFromNow.setDate(today.getDate() + 14);
          const sixMonthsLater = new Date(today);
          sixMonthsLater.setMonth(today.getMonth() + 6);

          const expirationDateGte = twoWeeksFromNow.toISOString().split('T')[0];
          const expirationDateLte = sixMonthsLater.toISOString().split('T')[0];

          const minimalSnapshots = await fetchOptionsData(symbol, expirationDateGte, expirationDateLte, true);

          if (minimalSnapshots && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'options_snapshot',
              data: minimalSnapshots
            }));
          }
        } catch (error) {
          console.error('Failed to fetch options:', error);
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'subscribed', symbol }));
        }
      }

      if (data.type === 'unsubscribe') {
        if (alpacaStream && currentSymbol && streamConnected) {
          await alpacaStream.unsubscribe(['bars'], [currentSymbol]);
          currentSymbol = null;
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
      }
    }
  });

  ws.on('close', async () => {
    console.log('Client disconnected');
    if (alpacaStream && currentSymbol && streamConnected) {
      try {
        await alpacaStream.unsubscribe(['bars'], [currentSymbol]);
      } catch (e) {
        console.log('Error cleaning up:', e.message);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});
