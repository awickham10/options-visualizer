/**
 * Request ID Middleware
 *
 * Assigns a unique request ID to each HTTP request for tracing and correlation.
 * The request ID is attached to the request object and included in all logs.
 */

import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { RequestWithId } from '../types'

/**
 * Generate and attach a unique request ID to each request
 */
function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate a unique request ID
  const requestId = randomUUID()

  // Attach to request object for use in route handlers
  ;(req as RequestWithId).id = requestId

  // Add to response headers for client-side debugging
  res.setHeader('X-Request-ID', requestId)

  next()
}

export default requestIdMiddleware
