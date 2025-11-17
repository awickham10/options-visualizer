/**
 * HTTP Request Logging Middleware
 *
 * Logs HTTP requests and responses with timing information.
 * Integrates with the request ID middleware for correlation.
 */

const logger = require('../utils/logger');

/**
 * Log HTTP requests and responses
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function httpLoggerMiddleware(req, res, next) {
  const startTime = Date.now();

  // Create a child logger with request context
  req.logger = logger.child({
    requestId: req.requestId || 'unknown',
    method: req.method,
    url: req.url,
  });

  // Log incoming request
  req.logger.info({
    type: 'request',
    userAgent: req.get('user-agent'),
    ip: req.ip || req.connection.remoteAddress,
  }, 'Incoming request');

  // Intercept the response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    req.logger[logLevel]({
      type: 'response',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    }, 'Request completed');
  });

  // Intercept errors
  res.on('error', (error) => {
    req.logger.error({
      type: 'response_error',
      error: error.message,
      stack: error.stack,
    }, 'Request error');
  });

  next();
}

module.exports = httpLoggerMiddleware;
