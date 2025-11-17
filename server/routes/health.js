const express = require('express');
const { getStreamingStatus } = require('../websocket/streamManager');

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const status = getStreamingStatus();
  res.json({
    success: true,
    status: status.connected ? 'connected' : 'disconnected',
    streaming: status.connected,
    streamingEnabled: status.enabled
  });
});

module.exports = router;
