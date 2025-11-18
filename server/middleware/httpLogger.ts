/**
 * HTTP Request Logging Middleware
 *
 * Logs HTTP requests and responses with timing information.
 * Integrates with the request ID middleware for correlation.
 */

import { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger'
import { RequestWithId, Logger } from '../types'

// Extend Express Request to include logger
interface RequestWithLogger extends RequestWithId {
  logger?: Logger
}

/**
 * Log HTTP requests and responses
 */
function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now()
  const reqWithId = req as RequestWithId
  const reqWithLogger = req as RequestWithLogger

  // Create a child logger with request context
  reqWithLogger.logger = logger.child({
    requestId: reqWithId.id || 'unknown',
    method: req.method,
    url: req.url,
  })

  // Log incoming request
  reqWithLogger.logger.info({
    type: 'request',
    userAgent: req.get('user-agent'),
    ip: req.ip || req.socket.remoteAddress,
  }, 'Incoming request')

  // Intercept the response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime

    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'

    reqWithLogger.logger![logLevel]({
      type: 'response',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    }, 'Request completed')
  })

  // Intercept errors
  res.on('error', (error: Error) => {
    reqWithLogger.logger!.error({
      type: 'response_error',
      error: error.message,
      stack: error.stack,
    }, 'Request error')
  })

  next()
}

export default httpLoggerMiddleware
