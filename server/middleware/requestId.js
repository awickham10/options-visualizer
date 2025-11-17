/**
 * Request ID Middleware
 *
 * Assigns a unique request ID to each HTTP request for tracing and correlation.
 * The request ID is attached to the request object and included in all logs.
 */

const { randomUUID } = require('crypto');

/**
 * Generate and attach a unique request ID to each request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function requestIdMiddleware(req, res, next) {
  // Generate a unique request ID
  const requestId = randomUUID();

  // Attach to request object for use in route handlers
  req.requestId = requestId;

  // Add to response headers for client-side debugging
  res.setHeader('X-Request-ID', requestId);

  next();
}

module.exports = requestIdMiddleware;
