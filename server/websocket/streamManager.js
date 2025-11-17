const WebSocket = require('ws');
const logger = require('../utils/logger');
const alpaca = require('../config/alpaca');
const { fetchOptionsData } = require('../api/alpacaService');

/**
 * WebSocket Stream Manager
 * Manages WebSocket connections and Alpaca data streaming
 */

// Single shared Alpaca data stream for all clients
let alpacaStream = null;
let streamConnected = false;
let streamingEnabled = true; // Can be disabled if not available
let authErrorCount = 0;
const MAX_AUTH_FAILURES = 3;

/**
 * Initialize Alpaca streaming connection
 * @returns {Promise<object>} - Alpaca stream instance
 */
async function initializeAlpacaStream() {
  if (!alpacaStream && streamingEnabled) {
    alpacaStream = alpaca.data_stream_v2;

    alpacaStream.onError((error) => {
      logger.error({ error: error.toString() }, 'Alpaca stream error');
      if (error.toString().includes('auth failed')) {
        authErrorCount++;
        if (authErrorCount >= MAX_AUTH_FAILURES) {
          logger.warn('Real-time streaming not available. App will use REST API only.');
          streamingEnabled = false;
          streamConnected = false;
          // Don't treat streaming failure as critical - REST API still works
        }
      } else {
        streamConnected = false;
      }
    });

    alpacaStream.onStateChange((state) => {
      logger.info({ state }, 'Alpaca stream state changed');
      if (state === 'authenticated') {
        streamConnected = true;
        authErrorCount = 0;
        logger.info('Real-time streaming enabled');
      }
    });

    try {
      await alpacaStream.connect();
      logger.info('Alpaca data stream connected');
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to connect Alpaca stream');
      streamConnected = false;
    }
  }
  return alpacaStream;
}

/**
 * Get current streaming status
 * @returns {object} - { connected, enabled }
 */
function getStreamingStatus() {
  return {
    connected: streamConnected,
    enabled: streamingEnabled
  };
}

/**
 * Handle WebSocket client connections
 * @param {WebSocket} ws - WebSocket client connection
 */
function handleConnection(ws) {
  logger.info('Client connected to WebSocket');

  let currentSymbol = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe') {
        await handleSubscribe(ws, data.symbol, currentSymbol);
        currentSymbol = data.symbol;
      }

      if (data.type === 'unsubscribe') {
        await handleUnsubscribe(currentSymbol);
        currentSymbol = null;
      }
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'WebSocket message error');
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
      }
    }
  });

  ws.on('close', async () => {
    logger.info('Client disconnected');
    if (currentSymbol) {
      await handleUnsubscribe(currentSymbol);
    }
  });

  ws.on('error', (error) => {
    logger.error({ error: error.message }, 'WebSocket error');
  });
}

/**
 * Handle subscription request from client
 * @param {WebSocket} ws - WebSocket client
 * @param {string} symbol - Stock symbol to subscribe to
 * @param {string} previousSymbol - Previously subscribed symbol (if any)
 */
async function handleSubscribe(ws, symbol, previousSymbol) {
  logger.info({ symbol }, 'Subscribing to symbol streams');

  // Check if stream is connected
  if (!streamConnected) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Real-time data stream not available. Showing historical data only.'
    }));
    logger.warn('Alpaca stream not connected, skipping subscription');
  } else {
    // Unsubscribe from previous symbol if any
    if (previousSymbol) {
      try {
        await alpacaStream.unsubscribeFromBars([previousSymbol]);
        logger.info({ symbol: previousSymbol }, 'Unsubscribed from symbol');
      } catch (e) {
        logger.warn({ error: e.message, symbol: previousSymbol }, 'Error unsubscribing');
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
      await alpacaStream.subscribeForBars([symbol]);
      logger.info({ symbol }, 'Subscribed to bars');
    } catch (error) {
      logger.error({ error: error.message, symbol }, 'Failed to subscribe');
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
    logger.error({ error: error.message, symbol }, 'Failed to fetch options');
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribed', symbol }));
  }
}

/**
 * Handle unsubscribe request
 * @param {string} symbol - Symbol to unsubscribe from
 */
async function handleUnsubscribe(symbol) {
  if (alpacaStream && symbol && streamConnected) {
    try {
      await alpacaStream.unsubscribeFromBars([symbol]);
      logger.info({ symbol }, 'Unsubscribed from symbol');
    } catch (e) {
      logger.warn({ error: e.message, symbol }, 'Error cleaning up subscription');
    }
  }
}

module.exports = {
  initializeAlpacaStream,
  getStreamingStatus,
  handleConnection
};
