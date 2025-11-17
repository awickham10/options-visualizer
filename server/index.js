const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

// Import routes
const stocksRouter = require('./routes/stocks');
const optionsRouter = require('./routes/options');
const healthRouter = require('./routes/health');

// Import WebSocket stream manager
const { initializeAlpacaStream, handleConnection } = require('./websocket/streamManager');

// Initialize Express app
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api', stocksRouter);
app.use('/api', optionsRouter);
app.use('/api', healthRouter);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on('connection', handleConnection);

// Initialize Alpaca stream on server start
initializeAlpacaStream().catch(err => {
  console.error('Failed to initialize Alpaca stream:', err);
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});
