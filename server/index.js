const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import logger and middleware
const logger = require('./utils/logger');
const requestIdMiddleware = require('./middleware/requestId');
const httpLoggerMiddleware = require('./middleware/httpLogger');

// Import routes
const stocksRouter = require('./routes/stocks');
const optionsRouter = require('./routes/options');

// Initialize Express app
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(httpLoggerMiddleware);

// Mount routes
app.use('/api', stocksRouter);
app.use('/api', optionsRouter);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
