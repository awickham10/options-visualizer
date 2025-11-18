/**
 * Frontend Logger Utility
 *
 * Provides structured logging with environment-aware log levels.
 * In production, only ERROR and WARN messages are logged.
 * In development, all log levels are active.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const

class Logger {
  private isDevelopment: boolean
  private minLevel: number

  constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development'
    // In production, only show WARN and ERROR
    this.minLevel = this.isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN
  }

  /**
   * Log debug messages (development only)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args)
    }
  }

  /**
   * Log informational messages (development only in default config)
   */
  info(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LOG_LEVELS.INFO) {
      console.log(`[INFO] ${message}`, ...args)
    }
  }

  /**
   * Log warning messages
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  }

  /**
   * Log error messages
   */
  error(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${message}`, ...args)
    }
  }
}

// Export singleton instance
export const logger = new Logger()
