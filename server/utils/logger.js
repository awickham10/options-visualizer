/**
 * Backend Logger Utility
 *
 * Provides structured logging using Pino with environment-aware configuration.
 * - Development: Pretty-printed, human-readable logs
 * - Production: JSON-formatted logs for monitoring tools
 */

const pino = require('pino');

// Determine log level from environment variable or default to 'info'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Configure Pino logger
const logger = pino({
  level: LOG_LEVEL,
  transport: !isProduction ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
    }
  } : undefined, // In production, use default JSON format
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with additional context
 * @param {Object} bindings - Additional context to bind to all log messages
 * @returns {Object} Child logger instance
 *
 * @example
 * const reqLogger = logger.child({ requestId: '123' })
 * reqLogger.info('Processing request')
 */
logger.child = function(bindings) {
  return pino({
    ...this.bindings(),
    ...bindings
  }, this);
};

module.exports = logger;
